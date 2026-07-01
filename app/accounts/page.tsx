import Link from "next/link";
import { Download, ExternalLink, Table as TableIcon, LayoutGrid } from "lucide-react";
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Button } from "@/components/ui";
import { AccountFilters } from "@/components/account-filters";
import { SortHeader, Pager } from "@/components/account-table-bits";
import { StatusBadge } from "@/components/crm-panel";
import { BucketSection } from "@/components/account-browse";
import { InfoTip } from "@/components/info-tip";
import { listAccounts, getFilterOptions, getAccountBuckets, type AccountFilters as Filters, type CrmFilter, type QualityFilter } from "@/lib/queries";
import { type Status } from "@/lib/crm-constants";
import { EXPLAIN } from "@/lib/explain";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// The three MVP territories we're nailing first.
const MVP_STATES = ["CA", "TX", "FL"] as const;
const STATE_NAME: Record<string, string> = { CA: "California", TX: "Texas", FL: "Florida" };

function parseFilters(sp: SP): Filters {
  return {
    q: one(sp.q),
    oem: one(sp.oem) ? one(sp.oem)!.split(",").filter(Boolean) : undefined,
    country: one(sp.country),
    territory: one(sp.territory),
    state: one(sp.state),
    tier: one(sp.tier),
    status: one(sp.status),
    hasWebsite: !!one(sp.hasWebsite),
    hasPhone: !!one(sp.hasPhone),
    brandConfirmed: !!one(sp.brandConfirmed),
    sort: one(sp.sort),
    dir: one(sp.dir) === "desc" ? "desc" : "asc",
    page: Number(one(sp.page)) || 1,
    pageSize: 25,
  };
}

function StatusDot({ state, title }: { state: boolean | null; title: string }) {
  const color = state === true ? "bg-emerald-500" : state === false ? "bg-destructive" : "bg-muted-foreground/40";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={`${title}: ${state == null ? "unknown" : state ? "valid" : "invalid"}`} />;
}

/** State scope chips — calm way to narrow a big book to one territory. */
function StateChips({ active, view }: { active: string | null; view: "cards" | "table" }) {
  const base = "rounded-full border px-3 py-1 text-sm transition-colors";
  const on = "border-foreground bg-foreground text-background";
  const off = "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40";
  const v = view === "table" ? "?view=table" : "";
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/accounts${v}`} className={`${base} ${!active ? on : off}`}>All three</Link>
      {MVP_STATES.map((s) => (
        <Link key={s} href={`/accounts?state=${s}${view === "table" ? "&view=table" : ""}`} className={`${base} ${active === s ? on : off}`}>
          {STATE_NAME[s]}
        </Link>
      ))}
    </div>
  );
}

export default async function AccountsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = one(sp.view) === "table" ? "table" : "cards";
  const stateParam = one(sp.state)?.toUpperCase() ?? null;
  const scopeStates = stateParam ? [stateParam] : [...MVP_STATES];

  const scopeLabel = stateParam ? STATE_NAME[stateParam] ?? stateParam : "California, Texas & Florida";

  // Toggle link preserves the current state scope.
  const stateQ = stateParam ? `state=${stateParam}` : "";
  const cardsHref = `/accounts${stateQ ? `?${stateQ}` : ""}`;
  const tableHref = `/accounts?${[stateQ, "view=table"].filter(Boolean).join("&")}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">{scopeLabel} — grouped by what to do next.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Link href={cardsHref} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm ${view === "cards" ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}>
              <LayoutGrid className="h-4 w-4" /> Cards
            </Link>
            <Link href={tableHref} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm ${view === "table" ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}>
              <TableIcon className="h-4 w-4" /> Table
            </Link>
          </div>
        </div>
      </div>

      <StateChips active={stateParam} view={view} />

      {view === "cards" ? (
        <CardView
          states={scopeStates}
          stateParam={stateParam}
          crm={(one(sp.crm) as CrmFilter) ?? "all"}
          quality={(one(sp.quality) as QualityFilter) ?? "trusted"}
        />
      ) : (
        <TableView sp={sp} />
      )}
    </div>
  );
}

/* Quality chips — make trust an active control: working views hide noise, default to verified. */
function QualityChips({ active, stateParam, crm }: { active: QualityFilter; stateParam: string | null; crm: CrmFilter }) {
  const base = "rounded-full border px-3 py-1 text-sm transition-colors";
  const on = "border-foreground bg-foreground text-background";
  const off = "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40";
  const href = (qf: QualityFilter) =>
    `/accounts?${[stateParam ? `state=${stateParam}` : "", crm === "all" ? "" : `crm=${crm}`, qf === "trusted" ? "" : `quality=${qf}`].filter(Boolean).join("&")}` || "/accounts";
  const opts: { key: QualityFilter; label: string }[] = [
    { key: "trusted", label: "Verified only" },
    { key: "manufacturer", label: "Manufacturer-verified" },
    { key: "all", label: "Include unverified" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trust</span>
      {opts.map((o) => (
        <Link key={o.key} href={href(o.key)} className={`${base} ${active === o.key ? on : off}`}>
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/* Coverage chips — split the book by Pam's existing CRM footprint. */
function CoverageChips({ active, stateParam }: { active: CrmFilter; stateParam: string | null }) {
  const base = "rounded-full border px-3 py-1 text-sm transition-colors";
  const on = "border-foreground bg-foreground text-background";
  const off = "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40";
  const href = (c: CrmFilter) =>
    `/accounts?${[stateParam ? `state=${stateParam}` : "", c === "all" ? "" : `crm=${c}`].filter(Boolean).join("&")}` || "/accounts";
  const opts: { key: CrmFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "netnew", label: "Net-new (not in Pam's CRM)" },
    { key: "incrm", label: "In Pam's CRM" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <Link key={o.key} href={href(o.key)} className={`${base} ${active === o.key ? on : off}`}>
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/* ---------- Card view: calm, chunked by work-readiness ---------- */

function CardView({ states, stateParam, crm, quality }: { states: string[]; stateParam: string | null; crm: CrmFilter; quality: QualityFilter }) {
  const { buckets, total } = getAccountBuckets(states, crm, quality);
  const seeAll = (key: string) =>
    `/accounts?${[stateParam ? `state=${stateParam}` : "", crm === "all" ? "" : `crm=${crm}`, quality === "trusted" ? "" : `quality=${quality}`, "view=table"].filter(Boolean).join("&")}#${key}`;
  const qualNote = quality === "trusted" ? "multi-source verified" : quality === "manufacturer" ? "manufacturer-confirmed" : "all (incl. unverified)";
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <CoverageChips active={crm} stateParam={stateParam} />
        <QualityChips active={quality} stateParam={stateParam} crm={crm} />
      </div>
      <p className="text-sm text-muted-foreground">
        {fmt(total)} <span className="font-medium text-foreground">{qualNote}</span> rooftops
        {crm === "netnew" ? " Pam has never touched" : crm === "incrm" ? " in Pam's CRM" : ""}. Noise hidden.
      </p>
      <div className="space-y-8">
        {buckets.map((b) => (
          <BucketSection key={b.key} bucket={b} seeAllHref={seeAll(b.key)} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Table view: the full, power-user list (progressive disclosure) ---------- */

function TableView({ sp }: { sp: SP }) {
  const filters = parseFilters(sp);
  const options = getFilterOptions();
  const { rows, total, page, pageCount, pageSize } = listAccounts(filters);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = one(v);
    if (val) qs.set(k, val);
  }
  const exportHref = `/api/export?${qs.toString()}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{fmt(total)} matching rooftops</p>
        <Link href={exportHref}>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </Link>
      </div>

      <AccountFilters options={options} />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><SortHeader column="name" label="Dealership" /></TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  <SortHeader column="status" label="Status" />
                  <InfoTip label="Status">{EXPLAIN.status}</InfoTip>
                </span>
              </TableHead>
              <TableHead><SortHeader column="oem" label="OEM" /></TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  <SortHeader column="tier" label="Tier" />
                  <InfoTip label="Tier">{EXPLAIN.tier}</InfoTip>
                </span>
              </TableHead>
              <TableHead><SortHeader column="city" label="City" /></TableHead>
              <TableHead><SortHeader column="state_province" label="State" /></TableHead>
              <TableHead><SortHeader column="country" label="Country" /></TableHead>
              <TableHead>Territory</TableHead>
              <TableHead className="text-center">Web</TableHead>
              <TableHead className="text-center">Tel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  No rooftops match these filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/accounts/${r.id}`} className="font-medium text-foreground hover:text-primary">
                    {r.name}
                  </Link>
                  {r.group_name && <div className="text-xs text-muted-foreground">{r.group_name}</div>}
                </TableCell>
                <TableCell><StatusBadge status={(r.status as Status) ?? "new"} /></TableCell>
                <TableCell>{r.oem ? <Badge variant="muted">{r.oem}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {r.tier === "A" ? (
                    <Badge variant="brand">Tier A</Badge>
                  ) : r.tier ? (
                    <Badge variant="muted">Tier {r.tier}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.city ?? "—"}</TableCell>
                <TableCell>{r.state_province ?? "—"}</TableCell>
                <TableCell>{r.country ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{r.territory ?? "—"}</TableCell>
                <TableCell className="text-center">
                  {r.website ? (
                    <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                      <StatusDot state={r.website_valid === null ? null : r.website_valid === 1} title="Website" />
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {r.phone ? <StatusDot state={r.phone_valid === 1} title="Phone" /> : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Pager page={page} pageCount={pageCount} total={total} pageSize={pageSize} />
    </div>
  );
}
