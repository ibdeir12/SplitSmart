"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type GroupOption = { id: number; name: string };

export function GroupSwitcher({ groups, currentId }: { groups: GroupOption[]; currentId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400">Group</span>
      <select
        value={currentId}
        disabled={pending}
        aria-busy={pending}
        onChange={(e) => startTransition(() => router.push(`/groups/${e.target.value}`))}
        className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-sm"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </label>
  );
}
