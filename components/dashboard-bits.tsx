import { Card, CardContent, CardHeader, CardTitle } from "./ui";
import { InfoTip } from "./info-tip";
import { cn } from "@/lib/ui";
import { fmt } from "@/lib/format";
import type { Tally } from "@/lib/queries";

export function KpiCard({
  title,
  value,
  sub,
  accent,
  info,
}: {
  title: string;
  value: string;
  sub?: string;
  accent?: boolean;
  info?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {title}
          {info && <InfoTip label={title}>{info}</InfoTip>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-semibold tracking-tight", accent && "text-brand")}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/** Horizontal bar list — a lightweight, server-rendered chart. */
export function BarList({ items, color = "primary" }: { items: Tally[]; color?: "primary" | "brand" }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  const bar = color === "brand" ? "bg-brand" : "bg-primary";
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-sm text-muted-foreground" title={it.label}>
            {it.label}
          </div>
          <div className="relative h-6 flex-1 overflow-hidden rounded bg-muted">
            <div
              className={cn("absolute inset-y-0 left-0 rounded", bar)}
              style={{ width: `${Math.max(2, (100 * it.n) / max)}%`, opacity: 0.85 }}
            />
          </div>
          <div className="w-14 shrink-0 text-right text-sm font-medium tabular-nums">{fmt(it.n)}</div>
        </div>
      ))}
    </div>
  );
}
