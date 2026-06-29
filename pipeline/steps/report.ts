import { loadAll } from "./persist";
import type { MasterRecord } from "../../lib/types";

const pct = (num: number, den: number) => (den === 0 ? "0.0%" : `${((100 * num) / den).toFixed(1)}%`);

function tallyBy(rows: MasterRecord[], key: (r: MasterRecord) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || "(unknown)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export interface ReportInput {
  removedByDedupe?: number;
}

export function runReport(input: ReportInput = {}): void {
  const rows = loadAll();
  const total = rows.length;
  const L = (s = "") => console.log(s);

  L();
  L("═══════════════════════════════════════════════════════════════");
  L("  DEALERSHIP SOR — QA SUMMARY");
  L("═══════════════════════════════════════════════════════════════");
  L(`  Total dealership records:        ${total}`);
  if (input.removedByDedupe != null) {
    L(`  Duplicates merged (this run):    ${input.removedByDedupe}`);
  }
  L();

  L("  By country");
  L("  ─────────────────────────────");
  for (const [c, n] of tallyBy(rows, (r) => r.country ?? "")) {
    L(`    ${c.padEnd(6)} ${String(n).padStart(7)}   ${pct(n, total)}`);
  }
  L();

  L("  By OEM (top 25)");
  L("  ─────────────────────────────");
  for (const [oem, n] of tallyBy(rows, (r) => r.oem ?? "").slice(0, 25)) {
    L(`    ${oem.padEnd(16)} ${String(n).padStart(7)}`);
  }
  L();

  L("  By source");
  L("  ─────────────────────────────");
  for (const [s, n] of tallyBy(rows, (r) => r.source)) {
    L(`    ${s.padEnd(20)} ${String(n).padStart(7)}`);
  }
  L();

  L("  Tier");
  L("  ─────────────────────────────");
  for (const [t, n] of tallyBy(rows, (r) => (r.tier ? `Tier ${r.tier}` : "(untiered)"))) {
    L(`    ${t.padEnd(12)} ${String(n).padStart(7)}   ${pct(n, total)}`);
  }
  L();

  // Validation coverage
  const withSite = rows.filter((r) => r.website).length;
  const siteValid = rows.filter((r) => r.websiteValid === true).length;
  const siteChecked = rows.filter((r) => r.websiteValid != null).length;
  const withPhone = rows.filter((r) => r.phone).length;
  const phoneValid = rows.filter((r) => r.phoneValid === true).length;
  const brandConfirmed = rows.filter((r) => r.brandConfirmed).length;

  L("  Data quality");
  L("  ─────────────────────────────");
  L(`    Has website:                   ${withSite}  (${pct(withSite, total)})`);
  L(`    Website valid (of checked):    ${siteValid}/${siteChecked}  (${pct(siteValid, siteChecked)})`);
  L(`    Has phone:                     ${withPhone}  (${pct(withPhone, total)})`);
  L(`    Phone valid (of present):      ${phoneValid}/${withPhone}  (${pct(phoneValid, withPhone)})`);
  L(`    Brand confirmed (OEM source):  ${brandConfirmed}  (${pct(brandConfirmed, total)})`);
  L("═══════════════════════════════════════════════════════════════");
  L();
}
