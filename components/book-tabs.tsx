import Link from "next/link";
import { cn } from "@/lib/ui";

/** List ⇄ Board view switch for the Book (the rep's territory). */
export function BookTabs({ current }: { current: "list" | "board" }) {
  const tab = (href: string, key: "list" | "board", label: string) => (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm transition-colors",
        current === key ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {tab("/accounts", "list", "List")}
      {tab("/pipeline", "board", "Board")}
    </div>
  );
}
