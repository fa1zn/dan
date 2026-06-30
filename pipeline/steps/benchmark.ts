import { existsSync, readFileSync } from "node:fs";
import { CONFIG } from "../config";
import { getSqlite } from "../../lib/db";

/*
 * Benchmark report. Compares Dan's per-state / per-brand counts against authority
 * totals from data/benchmarks.csv (columns: state, brand, authority_count) and flags
 * any brand/state where Dan is >5% short — a signal of a partial or blocked adapter.
 * Also prints total vs the ~24K target and the trust-tier breakdown.
 */

interface AuthRow {
  state: string;
  brand: string;
  authority: number;
}

function loadBenchmarks(): AuthRow[] {
  if (!existsSync(CONFIG.benchmarkCsv)) return [];
  const lines = readFileSync(CONFIG.benchmarkCsv, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  const out: AuthRow[] = [];
  for (const line of lines.slice(1)) {
    const [state, brand, count] = line.split(",").map((c) => c.trim());
    const n = Number(count);
    if (state && brand && Number.isFinite(n)) out.push({ state: state.toUpperCase(), brand, authority: n });
  }
  return out;
}

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const padR = (s: string | number, n: number) => String(s).padStart(n);
const variance = (mine: number, auth: number) => (auth === 0 ? "—" : `${(((mine - auth) / auth) * 100).toFixed(1)}%`);

export function runBenchmark(): void {
  const db = getSqlite();
  const L = (s = "") => console.log(s);

  const total = (db.prepare("SELECT COUNT(*) n FROM dealerships").get() as { n: number }).n;
  const byBrand = db
    .prepare("SELECT COALESCE(oem,'(unknown)') brand, COUNT(*) n FROM dealerships GROUP BY oem")
    .all() as { brand: string; n: number }[];
  const byStateBrand = new Map<string, number>();
  for (const r of db
    .prepare("SELECT state_province st, oem brand, COUNT(*) n FROM dealerships GROUP BY st, oem")
    .all() as { st: string; brand: string; n: number }[]) {
    if (r.st && r.brand) byStateBrand.set(`${r.st.toUpperCase()}|${r.brand}`, r.n);
  }
  const tiers = db
    .prepare("SELECT COALESCE(trust_tier,'flagged') t, COUNT(*) n FROM dealerships GROUP BY trust_tier")
    .all() as { t: string; n: number }[];
  const confirmed = db
    .prepare("SELECT confirmation_count c, COUNT(*) n FROM dealerships GROUP BY confirmation_count ORDER BY c")
    .all() as { c: number; n: number }[];

  const auth = loadBenchmarks();
  const authByBrand = new Map<string, number>();
  let authTotal = 0;
  for (const a of auth) {
    authByBrand.set(a.brand, (authByBrand.get(a.brand) ?? 0) + a.authority);
    authTotal += a.authority;
  }

  L();
  L("═══════════════════════════════════════════════════════════════════════");
  L("  DEALERSHIP SOR — BENCHMARK REPORT");
  L("═══════════════════════════════════════════════════════════════════════");
  L(`  Total rooftops: ${total.toLocaleString()}   ·   Target: ~${CONFIG.targetTotal.toLocaleString()}   ·   ${((100 * total) / CONFIG.targetTotal).toFixed(1)}% of target`);
  if (authTotal) L(`  Authority total (benchmarks.csv): ${authTotal.toLocaleString()}   ·   variance ${variance(total, authTotal)}`);
  else L(`  (No data/benchmarks.csv supplied — showing Dan's counts only. Add it for the full comparison.)`);
  L();

  L(`  ${pad("Brand", 16)} ${padR("Dan", 7)} ${padR("Authority", 10)} ${padR("Variance", 10)}  Flag`);
  L("  " + "─".repeat(60));
  for (const b of byBrand.sort((a, z) => z.n - a.n)) {
    const a = authByBrand.get(b.brand);
    const short = a != null && b.n < a * 0.95;
    L(`  ${pad(b.brand, 16)} ${padR(b.n, 7)} ${padR(a ?? "—", 10)} ${padR(a != null ? variance(b.n, a) : "—", 10)}  ${short ? "⚠ >5% short" : ""}`);
  }
  L();

  // Per-state/brand shortfalls (only when authority data is present).
  if (auth.length) {
    const shortfalls = auth
      .map((a) => ({ ...a, mine: byStateBrand.get(`${a.state}|${a.brand}`) ?? 0 }))
      .filter((a) => a.authority > 0 && a.mine < a.authority * 0.95)
      .sort((a, z) => z.authority - a.authority);
    L(`  Per-state/brand shortfalls (>5% short — likely partial/blocked adapter): ${shortfalls.length}`);
    L("  " + "─".repeat(60));
    for (const s of shortfalls.slice(0, 25)) {
      L(`    ${pad(`${s.state} ${s.brand}`, 24)} Dan ${padR(s.mine, 5)} / auth ${padR(s.authority, 5)}  (${variance(s.mine, s.authority)})`);
    }
    if (shortfalls.length > 25) L(`    … and ${shortfalls.length - 25} more`);
    L();
  }

  L("  Trust tiers (independent confirmations)");
  L("  " + "─".repeat(40));
  for (const t of ["platinum", "gold", "silver", "flagged"]) {
    const n = tiers.find((x) => x.t === t)?.n ?? 0;
    L(`    ${pad(t, 10)} ${padR(n, 7)}   ${pad("", 0)}${t === "platinum" ? "(3+ sources)" : t === "gold" ? "(2 sources)" : t === "silver" ? "(1 source)" : "(0 — unconfirmed)"}`);
  }
  L();
  L("  Confirmations per rooftop: " + confirmed.map((c) => `${c.c}→${c.n}`).join("  "));
  L("═══════════════════════════════════════════════════════════════════════");
  L();
}
