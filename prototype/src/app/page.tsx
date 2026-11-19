import Link from "next/link";
import { CreateGroupForm } from "@/components/CreateGroupForm";
import { Card, EmptyState } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { listGroups } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const groups = await listGroups(prisma);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your groups</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pick a group to add members, record expenses, and see balances.
          </p>
        </div>

        {groups.length === 0 ? (
          <EmptyState>No groups yet. Create your first group to get started.</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-emerald-500 transition-colors"
                >
                  <div className="font-medium truncate">{g.name}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {g.memberCount} {g.memberCount === 1 ? "member" : "members"} · {g.expenseCount}{" "}
                    {g.expenseCount === 1 ? "expense" : "expenses"}
                  </div>
                  <div className="mt-2 text-sm">
                    Total spent <span className="font-mono">{formatCents(g.totalCents)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Card title="New group" className="self-start">
        <CreateGroupForm />
      </Card>
    </div>
  );
}
