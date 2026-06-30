import Link from "next/link";
import { Badge } from "@/components/ui";
import { BookTabs } from "@/components/book-tabs";
import { listAccounts } from "@/lib/queries";
import { getPipelineCounts } from "@/lib/crm";
import { STATUSES, STATUS_META } from "@/lib/crm-constants";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

const COLUMN_CAP = 50;

export default function PipelinePage() {
  const counts = getPipelineCounts();

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Book</h1>
          <BookTabs current="board" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Your dealers by stage. Open one to work it.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((s) => {
          const total = counts[s];
          // "New" is the whole untouched book — show a count + link rather than thousands of cards.
          const rows = s === "new" ? [] : listAccounts({ status: s, pageSize: COLUMN_CAP, sort: "name" }).rows;
          return (
            <div key={s} className="flex w-72 shrink-0 flex-col rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_META[s].badge}>{STATUS_META[s].label}</Badge>
                </div>
                <span className="text-sm font-medium tabular-nums text-muted-foreground">{fmt(total)}</span>
              </div>

              <div className="flex flex-col gap-2 p-3">
                {s === "new" ? (
                  <Link
                    href="/accounts?status=new"
                    className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground hover:border-brand hover:text-foreground"
                  >
                    {fmt(total)} untouched rooftops
                    <div className="mt-1 text-xs">Browse the book →</div>
                  </Link>
                ) : rows.length === 0 ? (
                  <div className="px-1 py-3 text-sm text-muted-foreground">No accounts in this stage yet.</div>
                ) : (
                  rows.map((r) => (
                    <Link
                      key={r.id}
                      href={`/accounts/${r.id}`}
                      className="rounded-md border bg-background p-3 transition-colors hover:border-brand"
                    >
                      <div className="truncate text-sm font-medium">{r.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {r.oem && <Badge variant="muted">{r.oem}</Badge>}
                        <span>
                          {[r.city, r.state_province].filter(Boolean).join(", ") || r.country}
                        </span>
                      </div>
                      {r.owner && <div className="mt-1 text-xs text-muted-foreground">Owner: {r.owner}</div>}
                    </Link>
                  ))
                )}
                {s !== "new" && total > rows.length && (
                  <Link href={`/accounts?status=${s}`} className="px-1 py-1 text-xs text-primary hover:underline">
                    +{fmt(total - rows.length)} more →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
