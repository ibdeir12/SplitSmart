"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText = "Saving..." }: { children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? pendingText : children}
    </button>
  );
}
