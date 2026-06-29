import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { Card, Table, THead, TBody, TR, TH, TD, Badge, Button } from "@/components/ui";
import { AccountFilters } from "@/components/account-filters";
import { SortHeader, Pager } from "@/components/account-table-bits";
import { listAccounts, getFilterOptions, type AccountFilters as Filters } from "@/lib/queries";
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
    tier: one(sp.tier),
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
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">{fmt(total)} matching rooftops</p>
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
          <THead>
            <TR className="hover:bg-transparent">
              <TH><SortHeader column="name" label="Dealership" /></TH>
              <TH><SortHeader column="oem" label="OEM" /></TH>
              <TH><SortHeader column="tier" label="Tier" /></TH>
              <TH><SortHeader column="city" label="City" /></TH>
              <TH><SortHeader column="state_province" label="State" /></TH>
              <TH><SortHeader column="country" label="Country" /></TH>
              <TH>Territory</TH>
              <TH className="text-center">Web</TH>
              <TH className="text-center">Tel</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <TR>
                <TD colSpan={9} className="py-10 text-center text-muted-foreground">
                  No rooftops match these filters.
                </TD>
              </TR>
            )}
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>
                  <Link href={`/accounts/${r.id}`} className="font-medium text-foreground hover:text-primary">
                    {r.name}
                  </Link>
                  {r.group_name && <div className="text-xs text-muted-foreground">{r.group_name}</div>}
                </TD>
                <TD>{r.oem ? <Badge variant="muted">{r.oem}</Badge> : <span className="text-muted-foreground">—</span>}</TD>
                <TD>
                  {r.tier === "A" ? (
                    <Badge variant="brand">Tier A</Badge>
                  ) : r.tier ? (
                    <Badge variant="muted">Tier {r.tier}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TD>
                <TD className="whitespace-nowrap">{r.city ?? "—"}</TD>
                <TD>{r.state_province ?? "—"}</TD>
                <TD>{r.country ?? "—"}</TD>
                <TD className="whitespace-nowrap text-muted-foreground">{r.territory ?? "—"}</TD>
                <TD className="text-center">
                  {r.website ? (
                    <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                      <StatusDot state={r.website_valid === null ? null : r.website_valid === 1} title="Website" />
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TD>
                <TD className="text-center">
                  {r.phone ? <StatusDot state={r.phone_valid === 1} title="Phone" /> : <span className="text-muted-foreground">—</span>}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Pager page={page} pageCount={pageCount} total={total} pageSize={pageSize} />
    </div>
  );
}
