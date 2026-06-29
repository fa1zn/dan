import { NextResponse } from "next/server";
import { listAllAccounts, type AccountFilters } from "@/lib/queries";

export const dynamic = "force-dynamic";

const COLUMNS: { header: string; value: (r: Record<string, unknown>) => string }[] = [
  { header: "Company Name", value: (r) => str(r.name) },
  { header: "OEM Brand", value: (r) => str(r.oem) },
  { header: "Dealer Group", value: (r) => str(r.group_name) },
  { header: "Tier", value: (r) => str(r.tier) },
  { header: "City", value: (r) => str(r.city) },
  { header: "State/Region", value: (r) => str(r.state_province) },
  { header: "Country", value: (r) => str(r.country) },
  { header: "Territory", value: (r) => str(r.territory) },
  { header: "Website URL", value: (r) => str(r.website) },
  { header: "Domain", value: (r) => str(r.domain) },
  { header: "Phone Number", value: (r) => str(r.phone) },
  { header: "Website Valid", value: (r) => bool(r.website_valid) },
  { header: "Phone Valid", value: (r) => bool(r.phone_valid) },
  { header: "Brand Confirmed", value: (r) => (r.brand_confirmed ? "TRUE" : "FALSE") },
  { header: "Record ID", value: (r) => str(r.id) },
];

const str = (v: unknown) => (v == null ? "" : String(v));
const bool = (v: unknown) => (v == null ? "" : v ? "TRUE" : "FALSE");
const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function parse(sp: URLSearchParams): AccountFilters {
  const oem = sp.get("oem");
  return {
    q: sp.get("q") ?? undefined,
    oem: oem ? oem.split(",").filter(Boolean) : undefined,
    country: sp.get("country") ?? undefined,
    territory: sp.get("territory") ?? undefined,
    tier: sp.get("tier") ?? undefined,
    hasWebsite: !!sp.get("hasWebsite"),
    hasPhone: !!sp.get("hasPhone"),
    brandConfirmed: !!sp.get("brandConfirmed"),
    sort: sp.get("sort") ?? undefined,
    dir: sp.get("dir") === "desc" ? "desc" : "asc",
  };
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const rows = listAllAccounts(parse(sp)) as unknown as Record<string, unknown>[];

  const lines = [COLUMNS.map((c) => c.header).join(",")];
  for (const r of rows) lines.push(COLUMNS.map((c) => esc(c.value(r))).join(","));

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dan-accounts-${rows.length}.csv"`,
    },
  });
}
