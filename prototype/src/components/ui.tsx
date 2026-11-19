// Small presentational building blocks shared by the pages.

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 ${className}`}>
      {title && <h2 className="text-base font-semibold mb-3">{title}</h2>}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-4 text-sm text-slate-500 dark:text-slate-400 text-center">
      {children}
    </p>
  );
}

export const inputClass =
  "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60";

export const labelClass = "block text-sm font-medium mb-1";

export function FormMessage({ status, message }: { status: "idle" | "error" | "success"; message?: string }) {
  if (status === "idle" || !message) return null;
  const tone =
    status === "error"
      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
  return (
    <p role={status === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${tone}`}>
      {message}
    </p>
  );
}
