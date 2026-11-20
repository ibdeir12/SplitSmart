"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { recordExpenseAction } from "@/lib/actions";
import { idleState } from "@/lib/form-state";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { splitEqually } from "@/lib/split";
import { SubmitButton } from "./SubmitButton";
import { EmptyState, FormMessage, inputClass, labelClass } from "./ui";

type Member = { id: number; name: string };

export function ExpenseForm({ groupId, members }: { groupId: number; members: Member[] }) {
  const [state, action] = useActionState(recordExpenseAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  // All fields are controlled so a validation error from the server keeps what was typed
  // (React resets uncontrolled fields after a form action finishes).
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState<string>(() => String(members[0]?.id ?? ""));
  const [selected, setSelected] = useState<number[]>(() => members.map((m) => m.id));
  const knownMemberIds = useRef(new Set(members.map((m) => m.id)));

  // Members added after this form mounted are selected by default too.
  useEffect(() => {
    const added = members.filter((m) => !knownMemberIds.current.has(m.id)).map((m) => m.id);
    if (added.length === 0) return;
    for (const id of added) knownMemberIds.current.add(id);
    setSelected((prev) => [...prev, ...added]);
    setPayerId((prev) => (prev === "" ? String(added[0]) : prev));
  }, [members]);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setDescription("");
      setAmount("");
      setSelected(members.map((m) => m.id));
    }
  }, [state.submittedAt, state.status, members]);

  // Live preview of each participant's share, computed with the same code the server uses.
  const preview = useMemo(() => {
    if (amount.trim() === "" || selected.length === 0) return null;
    try {
      const cents = parseAmountToCents(amount);
      const shares = splitEqually(cents, selected);
      return shares.map((s) => ({
        name: members.find((m) => m.id === s.memberId)?.name ?? "?",
        share: formatCents(s.shareCents),
      }));
    } catch {
      return null;
    }
  }, [amount, selected, members]);

  if (members.length < 1) {
    return <EmptyState>Add at least one member before recording an expense.</EmptyState>;
  }

  function toggle(id: number, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <input
          id="description"
          name="description"
          required
          maxLength={200}
          placeholder="Groceries"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="amount" className={labelClass}>
            Amount (USD)
          </label>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            required
            placeholder="60.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="payerId" className={labelClass}>
            Paid by
          </label>
          <select
            id="payerId"
            name="payerId"
            required
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className={inputClass}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Split equally between</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const checked = selected.includes(m.id);
            return (
              <label
                key={m.id}
                className={`cursor-pointer select-none rounded-full border px-3 py-1 text-sm ${
                  checked
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                    : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  name="participantIds"
                  value={m.id}
                  checked={checked}
                  onChange={(e) => toggle(m.id, e.target.checked)}
                  className="sr-only"
                />
                {m.name}
              </label>
            );
          })}
        </div>
        {selected.length === 0 && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">Select at least one participant.</p>
        )}
      </fieldset>

      {preview && (
        <ul className="rounded-md bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
          {preview.map((p) => (
            <li key={p.name} className="flex justify-between gap-2">
              <span className="truncate">{p.name}</span>
              <span className="font-mono">{p.share}</span>
            </li>
          ))}
        </ul>
      )}

      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Recording...">Record expense</SubmitButton>
    </form>
  );
}
