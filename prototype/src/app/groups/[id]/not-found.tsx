import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function GroupNotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Group not found</h1>
      <EmptyState>That group does not exist or the link is wrong.</EmptyState>
      <Link href="/" className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
        Back to all groups
      </Link>
    </div>
  );
}
