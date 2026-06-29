"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui";

const PINNED = ["TX", "CA", "FL"];

export function StateTabs({
  current,
  states,
}: {
  current: string;
  states: { code: string; total: number; named: number }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const go = (code: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("state", code);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const named = (code: string) => states.find((s) => s.code === code)?.named ?? 0;
  const others = states.filter((s) => !PINNED.includes(s.code));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PINNED.map((code) => (
        <button
          key={code}
          onClick={() => go(code)}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors",
            current === code
              ? "border-brand bg-brand/10 text-brand"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {code}
          <span className="rounded bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{named(code)}</span>
        </button>
      ))}

      <div className="relative">
        <select
          value={PINNED.includes(current) ? "" : current}
          onChange={(e) => e.target.value && go(e.target.value)}
          className={cn(
            "h-9 appearance-none rounded-md border bg-background pl-3 pr-8 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            PINNED.includes(current) ? "text-muted-foreground" : "border-brand text-foreground"
          )}
        >
          <option value="">Other state…</option>
          {others.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} · {s.named} named / {s.total}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}
