import type { PrismaClient } from "@prisma/client";
import { computeBalances, type MemberBalance } from "./balances";
import { NotFoundError, ValidationError } from "./errors";
import { parseAmountToCents } from "./money";
import { splitEqually } from "./split";

// Business logic for SplitSmart. Every function takes the Prisma client so the
// same code runs against the app database and against a test database.

const NAME_MAX = 60;
const DESCRIPTION_MAX = 200;

function cleanName(raw: string, label: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name === "") throw new ValidationError(`Enter a ${label}.`);
  if (name.length > NAME_MAX) {
    throw new ValidationError(`${label[0].toUpperCase()}${label.slice(1)} must be at most ${NAME_MAX} characters.`);
  }
  return name;
}

function parseId(raw: unknown, label: string): number {
  const id = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(`Choose a valid ${label}.`);
  return id;
}

export async function createGroup(db: PrismaClient, rawName: string) {
  const name = cleanName(rawName, "group name");
  return db.group.create({ data: { name } });
}

export async function listGroups(db: PrismaClient) {
  const groups = await db.group.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, expenses: true } },
      expenses: { select: { amountCents: true } },
    },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    createdAt: g.createdAt,
    memberCount: g._count.members,
    expenseCount: g._count.expenses,
    totalCents: g.expenses.reduce((sum, e) => sum + e.amountCents, 0),
  }));
}

export async function getGroup(db: PrismaClient, rawGroupId: unknown) {
  const groupId = parseId(rawGroupId, "group");
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group) throw new NotFoundError("That group does not exist.");
  return group;
}

export async function addMember(db: PrismaClient, rawGroupId: unknown, rawName: string) {
  const group = await getGroup(db, rawGroupId);
  const name = cleanName(rawName, "member name");
  const existing = await db.member.findUnique({
    where: { groupId_name: { groupId: group.id, name } },
  });
  if (existing) throw new ValidationError(`${name} is already a member of ${group.name}.`);
  return db.member.create({ data: { groupId: group.id, name } });
}

export async function listMembers(db: PrismaClient, rawGroupId: unknown) {
  const group = await getGroup(db, rawGroupId);
  return db.member.findMany({ where: { groupId: group.id }, orderBy: { id: "asc" } });
}

export type RecordExpenseInput = {
  groupId: unknown;
  description: string;
  amount: string;
  payerId: unknown;
  participantIds: unknown[];
};

/**
 * Record an expense paid by one member and split equally among the selected
 * participants. The payer and every participant must belong to the group.
 */
export async function recordExpense(db: PrismaClient, input: RecordExpenseInput) {
  const group = await getGroup(db, input.groupId);

  const description = input.description.trim().replace(/\s+/g, " ");
  if (description === "") throw new ValidationError("Enter a description.");
  if (description.length > DESCRIPTION_MAX) {
    throw new ValidationError(`Description must be at most ${DESCRIPTION_MAX} characters.`);
  }

  const amountCents = parseAmountToCents(input.amount);
  const payerId = parseId(input.payerId, "payer");
  if (input.participantIds.length === 0) throw new ValidationError("Select at least one participant.");
  const participantIds = [...new Set(input.participantIds.map((p) => parseId(p, "participant")))];

  const members = await db.member.findMany({ where: { groupId: group.id }, select: { id: true } });
  const memberIds = new Set(members.map((m) => m.id));
  if (!memberIds.has(payerId)) throw new ValidationError("The payer must be a member of this group.");
  const outsiders = participantIds.filter((id) => !memberIds.has(id));
  if (outsiders.length > 0) {
    throw new ValidationError("Every participant must be a member of this group.");
  }

  const shares = splitEqually(amountCents, participantIds);

  return db.expense.create({
    data: {
      groupId: group.id,
      description,
      amountCents,
      payerId,
      shares: { create: shares },
    },
    include: { payer: true, shares: { include: { member: true } } },
  });
}

export async function listExpenses(db: PrismaClient, rawGroupId: unknown) {
  const group = await getGroup(db, rawGroupId);
  return db.expense.findMany({
    where: { groupId: group.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      payer: true,
      shares: { include: { member: true }, orderBy: { memberId: "asc" } },
    },
  });
}

export async function getBalances(db: PrismaClient, rawGroupId: unknown): Promise<MemberBalance[]> {
  const group = await getGroup(db, rawGroupId);
  const [members, expenses] = await Promise.all([
    db.member.findMany({ where: { groupId: group.id }, orderBy: { id: "asc" } }),
    db.expense.findMany({ where: { groupId: group.id }, include: { shares: true } }),
  ]);
  return computeBalances(members, expenses);
}
