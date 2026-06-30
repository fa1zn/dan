import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Button } from "@/components/ui";
import { AccountFilters } from "@/components/account-filters";
import { SortHeader, Pager } from "@/components/account-table-bits";
import { StatusBadge } from "@/components/crm-panel";
import { BookTabs } from "@/components/book-tabs";
import { InfoTip } from "@/components/info-tip";
import { listAccounts, getFilterOptions, type AccountFilters as Filters } from "@/lib/queries";
import { type Status } from "@/lib/crm-constants";
import { EXPLAIN } from "@/lib/explain";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

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

export default async function AccountsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
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
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Book</h1>
            <BookTabs current="list" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{fmt(total)} dealers in your territory</p>
        </div>
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
