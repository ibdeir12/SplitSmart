import Link from "next/link";
import { notFound } from "next/navigation";
import { AddMemberForm } from "@/components/AddMemberForm";
import { ExpenseForm } from "@/components/ExpenseForm";
import { GroupSwitcher } from "@/components/GroupSwitcher";
import { Card, EmptyState } from "@/components/ui";
import { prisma } from "@/lib/db";
import { isUserError } from "@/lib/errors";
import { formatCents, formatSignedCents } from "@/lib/money";
import { getBalances, getGroup, listExpenses, listGroups, listMembers } from "@/lib/services";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let group;
  try {
    group = await getGroup(prisma, id);
  } catch (e) {
    if (isUserError(e)) notFound();
    throw e;
  }

  const [groups, members, expenses, balances] = await Promise.all([
    listGroups(prisma),
    listMembers(prisma, group.id),
    listExpenses(prisma, group.id),
    getBalances(prisma, group.id),
  ]);
  const totalCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">
            All groups
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {members.length} {members.length === 1 ? "member" : "members"} · {expenses.length}{" "}
            {expenses.length === 1 ? "expense" : "expenses"} · {formatCents(totalCents)} total
          </p>
        </div>
        <GroupSwitcher groups={groups} currentId={group.id} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Members">
          {members.length === 0 ? (
            <EmptyState>No members yet. Add the people who share expenses in this group.</EmptyState>
          ) : (
            <ul className="mb-3 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {members.map((m) => (
                <li key={m.id} className="py-1.5">
                  {m.name}
                </li>
              ))}
            </ul>
          )}
          <AddMemberForm groupId={group.id} />
        </Card>

        <Card title="Balances">
          {members.length === 0 ? (
            <EmptyState>Balances appear once the group has members.</EmptyState>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1 font-medium">Member</th>
                  <th className="py-1 font-medium text-right">Paid</th>
                  <th className="py-1 font-medium text-right">Share</th>
                  <th className="py-1 font-medium text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {balances.map((b) => (
                  <tr key={b.memberId}>
                    <td className="py-1.5">{b.name}</td>
                    <td className="py-1.5 text-right font-mono">{formatCents(b.paidCents)}</td>
                    <td className="py-1.5 text-right font-mono">{formatCents(b.owedCents)}</td>
                    <td
                      className={`py-1.5 text-right font-mono font-semibold ${
                        b.netCents > 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : b.netCents < 0
                            ? "text-red-700 dark:text-red-400"
                            : "text-slate-500"
                      }`}
                    >
                      {formatSignedCents(b.netCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Positive: the group owes this member. Negative: this member owes the group.
          </p>
        </Card>

        <Card title="Record an expense">
          <ExpenseForm groupId={group.id} members={members} />
        </Card>
      </div>

      <Card title="Expense history">
        {expenses.length === 0 ? (
          <EmptyState>No expenses recorded yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1 font-medium">When</th>
                  <th className="py-1 font-medium">Description</th>
                  <th className="py-1 font-medium">Paid by</th>
                  <th className="py-1 font-medium">Split between</th>
                  <th className="py-1 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {dateFormat.format(e.createdAt)}
                    </td>
                    <td className="py-2">{e.description}</td>
                    <td className="py-2">{e.payer.name}</td>
                    <td className="py-2 text-slate-600 dark:text-slate-300">
                      {e.shares.map((s) => `${s.member.name} ${formatCents(s.shareCents)}`).join(", ")}
                    </td>
                    <td className="py-2 text-right font-mono whitespace-nowrap">{formatCents(e.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
