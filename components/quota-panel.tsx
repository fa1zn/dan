import { Card, CardContent, CardHeader, CardTitle } from "./ui";
import { fmt } from "@/lib/format";
import type { MonthPerf } from "@/lib/quota";

function Bar({ pct, expected }: { pct: number; expected?: number }) {
  return (
    <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} />
      {expected != null && expected > 0 && expected < 100 && (
        <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${expected}%` }} title="pace to hit quota" />
      )}
    </div>
  );
}

function money(n: number) {
  return `$${fmt(n)}`;
}

export function QuotaPanel({ perf }: { perf: MonthPerf }) {
  const demoPct = Math.round((100 * perf.demos) / Math.max(1, perf.demosQuota));
  const pacePct = Math.round((100 * perf.dayOfMonth) / perf.daysInMonth);
  const expectedDemos = Math.round((perf.demosQuota * perf.dayOfMonth) / perf.daysInMonth);
  const behind = expectedDemos - perf.demos;
  const paceLabel =
    behind <= 0 ? "on track" : `${behind} behind pace`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-base font-semibold text-foreground">This month</CardTitle>
          <span className="text-xs text-muted-foreground">
            {perf.monthLabel} · day {perf.dayOfMonth} of {perf.daysInMonth}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Demos booked</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-serif text-3xl font-medium tabular-nums">{perf.demos}</span>
              <span className="text-sm text-muted-foreground">/ {perf.demosQuota} quota</span>
            </div>
            <Bar pct={demoPct} expected={pacePct} />
            <div className="mt-1.5 text-xs">
              <span className={behind <= 0 ? "text-brand" : "text-muted-foreground"}>{paceLabel}</span>
              <span className="text-muted-foreground"> · {perf.perRepQuota} per rep</span>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Deals won</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-serif text-3xl font-medium tabular-nums">{perf.deals}</span>
              <span className="text-sm text-muted-foreground">closed</span>
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">across {perf.reps.length} rep{perf.reps.length === 1 ? "" : "s"}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">New MRR</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-serif text-3xl font-medium tabular-nums text-brand">{money(perf.mrr)}</span>
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">est. at ${fmt(1200)}/mo per deal</div>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <div className="mb-1 grid grid-cols-12 gap-2 text-xs text-muted-foreground">
            <div className="col-span-4">Salesperson</div>
            <div className="col-span-5">Demos</div>
            <div className="col-span-1 text-right">Deals</div>
            <div className="col-span-2 text-right">MRR</div>
          </div>
          {perf.reps.map((r) => {
            const pctRep = Math.round((100 * r.demos) / perf.perRepQuota);
            return (
              <div key={r.rep} className="grid grid-cols-12 items-center gap-2 py-1.5 text-sm">
                <div className="col-span-4 truncate font-medium">{r.rep}</div>
                <div className="col-span-5 flex items-center gap-2">
                  <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{r.demos}/{perf.perRepQuota}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, pctRep)}%` }} />
                  </div>
                </div>
                <div className="col-span-1 text-right tabular-nums">{r.deals}</div>
                <div className="col-span-2 text-right tabular-nums text-muted-foreground">{money(r.mrr)}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
