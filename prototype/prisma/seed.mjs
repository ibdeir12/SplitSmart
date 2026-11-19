// Idempotent demo data: safe to run repeatedly, never deletes anything.
// Run with: npm run db:seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO = {
  group: "Apartment 4B",
  members: ["Alice", "Bob", "Charlie"],
  expenses: [
    { description: "Groceries", amount: 6000, payer: "Alice", participants: ["Alice", "Bob", "Charlie"] },
    { description: "Internet bill", amount: 4500, payer: "Bob", participants: ["Alice", "Bob", "Charlie"] },
    { description: "Pizza night", amount: 1000, payer: "Charlie", participants: ["Alice", "Bob", "Charlie"] },
  ],
};

function splitEqually(amountCents, ids) {
  const sorted = [...ids].sort((a, b) => a - b);
  const base = Math.floor(amountCents / sorted.length);
  const leftover = amountCents - base * sorted.length;
  return sorted.map((memberId, i) => ({ memberId, shareCents: base + (i < leftover ? 1 : 0) }));
}

async function main() {
  let group = await prisma.group.findFirst({ where: { name: DEMO.group } });
  if (!group) {
    group = await prisma.group.create({ data: { name: DEMO.group } });
    console.log(`Created group "${group.name}"`);
  }

  const memberIds = {};
  for (const name of DEMO.members) {
    const member = await prisma.member.upsert({
      where: { groupId_name: { groupId: group.id, name } },
      update: {},
      create: { groupId: group.id, name },
    });
    memberIds[name] = member.id;
  }

  const existing = await prisma.expense.count({ where: { groupId: group.id } });
  if (existing === 0) {
    for (const e of DEMO.expenses) {
      await prisma.expense.create({
        data: {
          groupId: group.id,
          description: e.description,
          amountCents: e.amount,
          payerId: memberIds[e.payer],
          shares: { create: splitEqually(e.amount, e.participants.map((p) => memberIds[p])) },
        },
      });
    }
    console.log(`Created ${DEMO.expenses.length} demo expenses`);
  } else {
    console.log(`Group "${group.name}" already has ${existing} expense(s); nothing to add`);
  }
  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
