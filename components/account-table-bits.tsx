"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "./ui";
import { cn } from "@/lib/ui";
import { fmt } from "@/lib/format";

function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

export function SortHeader({ column, label, className }: { column: string; label: string; className?: string }) {
  const sp = useSearchParams();
  const setParams = useSetParams();
  const active = sp.get("sort") === column;
  const dir = sp.get("dir") === "desc" ? "desc" : "asc";

  const onClick = () =>
    setParams({ sort: column, dir: active && dir === "asc" ? "desc" : "asc", page: null });

  return (
    <button
      onClick={onClick}
      className={cn("inline-flex items-center gap-1 font-medium hover:text-foreground", active && "text-foreground", className)}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}

export function Pager({
  page,
  pageCount,
  total,
  pageSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const setParams = useSetParams();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-4 pt-1 text-sm text-muted-foreground">
      <div>
        Showing <span className="font-medium text-foreground">{fmt(from)}</span>–
        <span className="font-medium text-foreground">{fmt(to)}</span> of{" "}
        <span className="font-medium text-foreground">{fmt(total)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>
          Previous
        </Button>
        <span className="tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => setParams({ page: String(page + 1) })}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
