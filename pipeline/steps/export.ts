import { writeFileSync } from "node:fs";
import { CONFIG } from "../config";
import type { MasterRecord } from "../../lib/types";
import { loadAll } from "./persist";

/** HubSpot/Clay-friendly column headers mapped from MasterRecord fields. */
const COLUMNS: { header: string; value: (r: MasterRecord) => string }[] = [
  { header: "Company Name", value: (r) => r.name },
  { header: "OEM Brand", value: (r) => r.oem ?? "" },
  { header: "Dealer Group", value: (r) => r.groupName ?? "" },
  { header: "Group Size", value: (r) => (r.groupSize != null ? String(r.groupSize) : "") },
  { header: "Website URL", value: (r) => r.website ?? "" },
  { header: "Domain", value: (r) => r.domain ?? "" },
  { header: "Street Address", value: (r) => r.addressStreet ?? "" },
  { header: "City", value: (r) => r.city ?? "" },
  { header: "State/Region", value: (r) => r.stateProvince ?? "" },
  { header: "Postal Code", value: (r) => r.postalCode ?? "" },
  { header: "Country", value: (r) => r.country ?? "" },
  { header: "Territory", value: (r) => r.territory ?? "" },
  { header: "Latitude", value: (r) => (r.latitude != null ? String(r.latitude) : "") },
  { header: "Longitude", value: (r) => (r.longitude != null ? String(r.longitude) : "") },
  { header: "Phone Number", value: (r) => r.phone ?? "" },
  { header: "Email", value: (r) => r.email ?? "" },
  { header: "Tier", value: (r) => r.tier ?? "" },
  { header: "Tools Used", value: (r) => (r.toolsUsed?.length ? r.toolsUsed.join("; ") : "") },
  { header: "Source", value: (r) => r.source },
  { header: "Website Valid", value: (r) => boolCell(r.websiteValid) },
  { header: "Phone Valid", value: (r) => boolCell(r.phoneValid) },
  { header: "Brand Confirmed", value: (r) => (r.brandConfirmed ? "TRUE" : "FALSE") },
  { header: "Record ID", value: (r) => (r.id != null ? String(r.id) : "") },
];

const boolCell = (b: boolean | null) => (b == null ? "" : b ? "TRUE" : "FALSE");

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function runExport(): { path: string; rows: number } {
  const rows = loadAll();
  const lines = [COLUMNS.map((c) => c.header).join(",")];
  for (const r of rows) {
    lines.push(COLUMNS.map((c) => csvEscape(c.value(r))).join(","));
  }
  writeFileSync(CONFIG.csvPath, lines.join("\n") + "\n");
  return { path: CONFIG.csvPath, rows: rows.length };
}
