import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "./errors";
import {
  addMember,
  createGroup,
  getBalances,
  getGroup,
  listExpenses,
  listGroups,
  listMembers,
  recordExpense,
} from "./services";

// Integration tests against a throwaway SQLite database (prisma/test.db,
// gitignored). The schema is pushed with the Prisma CLI before the run.
const dbFile = path.join(process.cwd(), "prisma", "test.db");
const dbUrl = "file:./test.db";
let db: PrismaClient;

beforeAll(() => {
  if (existsSync(dbFile)) rmSync(dbFile);
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "ignore",
  });
  db = new PrismaClient({ datasourceUrl: dbUrl });
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) if (existsSync(f)) rmSync(f);
});

beforeEach(async () => {
  await db.expenseShare.deleteMany();
  await db.expense.deleteMany();
  await db.member.deleteMany();
  await db.group.deleteMany();
});

async function groupWithThree() {
  const group = await createGroup(db, "Apartment");
  const alice = await addMember(db, group.id, "Alice");
  const bob = await addMember(db, group.id, "Bob");
  const charlie = await addMember(db, group.id, "Charlie");
  return { group, alice, bob, charlie };
}

async function netByName(groupId: number) {
  const balances = await getBalances(db, groupId);
  return Object.fromEntries(balances.map((b) => [b.name, b.netCents]));
}

describe("groups and members", () => {
  it("creates a group and lists it", async () => {
    const group = await createGroup(db, "  Road   Trip ");
    expect(group.name).toBe("Road Trip");
    const groups = await listGroups(db);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: "Road Trip", memberCount: 0, expenseCount: 0 });
  });

  it("rejects a blank group name", async () => {
    await expect(createGroup(db, "   ")).rejects.toThrow(ValidationError);
  });

  it("adds three members and lists them in order", async () => {
    const { group } = await groupWithThree();
    const members = await listMembers(db, group.id);
    expect(members.map((m) => m.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("rejects duplicate members, blank names, and unknown groups", async () => {
    const { group } = await groupWithThree();
    await expect(addMember(db, group.id, "alice ")).resolves.toBeTruthy(); // different case is a different name
    await expect(addMember(db, group.id, "Alice")).rejects.toThrow(/already a member/);
    await expect(addMember(db, group.id, "")).rejects.toThrow(ValidationError);
    await expect(addMember(db, 9999, "Dana")).rejects.toThrow(NotFoundError);
    await expect(getGroup(db, "abc")).rejects.toThrow(ValidationError);
  });
});

describe("expenses and balances", () => {
  it("a $60 expense shared by three members gives +40 / -20 / -20", async () => {
    const { group, alice, bob, charlie } = await groupWithThree();
    await recordExpense(db, {
      groupId: group.id,
      description: "Groceries",
      amount: "60",
      payerId: alice.id,
      participantIds: [alice.id, bob.id, charlie.id],
    });
    expect(await netByName(group.id)).toEqual({ Alice: 4000, Bob: -2000, Charlie: -2000 });
  });

  it("a $10 expense shared by three members is allocated to the cent", async () => {
    const { group, alice, bob, charlie } = await groupWithThree();
    const expense = await recordExpense(db, {
      groupId: group.id,
      description: "Coffee",
      amount: "10.00",
      payerId: bob.id,
      participantIds: [charlie.id, bob.id, alice.id],
    });
    const shares = expense.shares.map((s) => [s.member.name, s.shareCents]).sort();
    expect(shares).toEqual([
      ["Alice", 334],
      ["Bob", 333],
      ["Charlie", 333],
    ]);
    expect(expense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(1000);
    expect(await netByName(group.id)).toEqual({ Alice: -334, Bob: 667, Charlie: -333 });
  });

  it("multiple expenses update balances correctly and always sum to zero", async () => {
    const { group, alice, bob, charlie } = await groupWithThree();
    const all = [alice.id, bob.id, charlie.id];
    await recordExpense(db, { groupId: group.id, description: "Rent", amount: "60", payerId: alice.id, participantIds: all });
    await recordExpense(db, { groupId: group.id, description: "Pizza", amount: "10", payerId: bob.id, participantIds: all });
    await recordExpense(db, { groupId: group.id, description: "Cab", amount: "7.77", payerId: charlie.id, participantIds: [bob.id, charlie.id] });

    const balances = await getBalances(db, group.id);
    expect(balances.reduce((sum, b) => sum + b.netCents, 0)).toBe(0);
    expect(await netByName(group.id)).toEqual({
      Alice: 6000 - 2000 - 334,
      Bob: 1000 - 2000 - 333 - 389,
      Charlie: 777 - 2000 - 333 - 388,
    });

    const history = await listExpenses(db, group.id);
    expect(history.map((e) => e.description)).toEqual(["Cab", "Pizza", "Rent"]);
    expect(history[0].payer.name).toBe("Charlie");
  });

  it("rejects invalid amounts", async () => {
    const { group, alice, bob } = await groupWithThree();
    for (const amount of ["0", "-5", "abc", "", "12.345"]) {
      await expect(
        recordExpense(db, { groupId: group.id, description: "Bad", amount, payerId: alice.id, participantIds: [alice.id, bob.id] }),
        amount,
      ).rejects.toThrow(ValidationError);
    }
    expect(await listExpenses(db, group.id)).toHaveLength(0);
  });

  it("rejects payers and participants who are not in the group", async () => {
    const { group, alice, bob } = await groupWithThree();
    const other = await createGroup(db, "Other");
    const outsider = await addMember(db, other.id, "Zed");

    await expect(
      recordExpense(db, { groupId: group.id, description: "x", amount: "10", payerId: outsider.id, participantIds: [alice.id] }),
    ).rejects.toThrow(/payer must be a member/);
    await expect(
      recordExpense(db, { groupId: group.id, description: "x", amount: "10", payerId: alice.id, participantIds: [bob.id, outsider.id] }),
    ).rejects.toThrow(/participant must be a member/);
    await expect(
      recordExpense(db, { groupId: group.id, description: "x", amount: "10", payerId: alice.id, participantIds: [bob.id, "nope"] }),
    ).rejects.toThrow(/valid participant/);
    await expect(
      recordExpense(db, { groupId: group.id, description: "x", amount: "10", payerId: 424242, participantIds: [bob.id] }),
    ).rejects.toThrow(ValidationError);
    await expect(
      recordExpense(db, { groupId: group.id, description: "x", amount: "10", payerId: alice.id, participantIds: [] }),
    ).rejects.toThrow(/at least one participant/);
    await expect(
      recordExpense(db, { groupId: group.id, description: "   ", amount: "10", payerId: alice.id, participantIds: [bob.id] }),
    ).rejects.toThrow(/description/);
    expect(await listExpenses(db, group.id)).toHaveLength(0);
  });

  it("persists data across client instances (survives a reload)", async () => {
    const { group, alice, bob } = await groupWithThree();
    await recordExpense(db, { groupId: group.id, description: "Dinner", amount: "25", payerId: alice.id, participantIds: [alice.id, bob.id] });

    const fresh = new PrismaClient({ datasourceUrl: dbUrl });
    try {
      expect(await listExpenses(fresh, group.id)).toHaveLength(1);
      const balances = await getBalances(fresh, group.id);
      expect(balances.find((b) => b.name === "Alice")?.netCents).toBe(1250);
    } finally {
      await fresh.$disconnect();
    }
  });
});
