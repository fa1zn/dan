import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { KpiCard, BarList } from "@/components/dashboard-bits";
import { getKpis, getByOem, getByTerritory, getByTier } from "@/lib/queries";
import { getPipelineCounts } from "@/lib/crm";
import { STATUSES, STATUS_META } from "@/lib/crm-constants";
import { fmt, pct } from "@/lib/format";
import { EXPLAIN } from "@/lib/explain";
import { InfoTip } from "@/components/info-tip";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const k = getKpis();
  const byOem = getByOem(15);
  const byTerritory = getByTerritory();
  const byTier = getByTier();
  const pipeline = getPipelineCounts();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Dan&rsquo;s book of business — {fmt(k.total)} franchise rooftops across the US and Canada.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard title="Total rooftops" value={fmt(k.total)} sub={`${fmt(k.us)} US · ${fmt(k.ca)} Canada`} />
        <KpiCard title="Tier A accounts" value={fmt(k.tierA)} sub={`${pct(k.tierA, k.total)} of book`} accent info={EXPLAIN.tierA} />
        <KpiCard title="Has website" value={pct(k.withWebsite, k.total)} sub={`${fmt(k.withWebsite)} rooftops`} />
        <KpiCard
          title="Website valid"
          value={pct(k.websiteValid, k.websiteChecked)}
          sub={`${fmt(k.websiteValid)} of ${fmt(k.websiteChecked)} checked`}
          info={EXPLAIN.websiteValid}
        />
        <KpiCard
          title="Phone valid"
          value={pct(k.phoneValid, k.withPhone)}
          sub={`${fmt(k.phoneValid)} of ${fmt(k.withPhone)} with phone`}
          info={EXPLAIN.phoneValid}
        />
        <KpiCard title="Brand confirmed" value={pct(k.brandConfirmed, k.total)} sub={`${fmt(k.brandConfirmed)} via OEM source`} info={EXPLAIN.brandConfirmed} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Dan&rsquo;s pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STATUSES.map((s) => (
              <Link
                key={s}
                href={`/accounts?status=${s}`}
                className="rounded-lg border p-4 transition-colors hover:border-brand hover:bg-accent"
              >
                <div className="text-2xl font-semibold tracking-tight">{fmt(pipeline[s])}</div>
                <div className="text-xs text-muted-foreground">{STATUS_META[s].label}</div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Rooftops by OEM</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={byOem} color="primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Rooftops by territory</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={byTerritory} color="brand" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            Tier breakdown
            <InfoTip label="Tier breakdown">{EXPLAIN.tier}</InfoTip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            {byTier.map((t) => (
              <div key={t.label}>
                <div className="text-2xl font-semibold tracking-tight">{fmt(t.n)}</div>
                <div className="text-xs text-muted-foreground">
                  {t.label} · {pct(t.n, k.total)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
