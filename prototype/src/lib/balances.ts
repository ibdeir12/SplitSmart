export type MemberBalance = {
  memberId: number;
  name: string;
  paidCents: number;
  owedCents: number;
  /** paid - owed. Positive: the group owes this member. Negative: they owe the group. */
  netCents: number;
};

type MemberInput = { id: number; name: string };
type ExpenseInput = {
  amountCents: number;
  payerId: number;
  shares: { memberId: number; shareCents: number }[];
};

/**
 * Compute each member's net balance from the group's expenses.
 * Because every expense's shares sum to its amount, the net balances always sum to zero.
 */
export function computeBalances(members: MemberInput[], expenses: ExpenseInput[]): MemberBalance[] {
  const byId = new Map<number, MemberBalance>();
  for (const m of members) {
    byId.set(m.id, { memberId: m.id, name: m.name, paidCents: 0, owedCents: 0, netCents: 0 });
  }
  for (const e of expenses) {
    const payer = byId.get(e.payerId);
    if (payer) payer.paidCents += e.amountCents;
    for (const s of e.shares) {
      const member = byId.get(s.memberId);
      if (member) member.owedCents += s.shareCents;
    }
  }
  for (const b of byId.values()) b.netCents = b.paidCents - b.owedCents;
  return [...byId.values()];
}
