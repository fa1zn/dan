/**
 * Pipeline orchestrator + CLI.
 *
 *   tsx pipeline/run.ts <command>
 *
 * Commands (each idempotent & resumable):
 *   ingest     fetch raw records from every enabled source → /data/raw/*.jsonl
 *   normalize  map raw → master schema, collapse exact dup keys → SQLite
 *   dedupe     merge duplicate rooftops (address key, domain fallback)
 *   validate   website_valid / phone_valid / brand_confirmed
 *   tier       Tier A/B classification
 *   export     write /data/dealerships.csv (HubSpot/Clay columns)
 *   report     print the QA summary
 *   all        run the whole pipeline end-to-end (default)
 */
import "./lib/load-env"; // must be first so CONFIG sees .env values
import { CONFIG } from "./config";
import { ALL_SOURCES, enabledSources } from "./sources";
import { readAllRaw, writeRaw } from "./lib/rawstore";
import { toMaster } from "./steps/normalize";
import { collapseExact, dedupeRecords } from "./steps/dedupe";
import { replaceAll, loadAll, countRows } from "./steps/persist";
import { runValidate } from "./steps/validate";
import { runEnrich } from "./steps/enrich";
import { runTier } from "./steps/tier";
import { runExport } from "./steps/export";
import { runReport } from "./steps/report";
import { runProvenance } from "./steps/provenance";
import { runResolve } from "./steps/resolve";
import { runBenchmark } from "./steps/benchmark";
import { runGooglePlaces } from "./integrations/google-places";
import { runMetaAds } from "./integrations/meta-ads";
import { runHubspot } from "./integrations/hubspot";
import { runZoomInfo } from "./integrations/zoominfo";

const nowIso = () => new Date().toISOString();
const banner = (s: string) => console.log(`\n▶ ${s}`);

async function ingest(): Promise<number> {
  banner("INGEST");
  const sources = enabledSources();
  console.log(
    `  enabled sources: ${sources.map((s) => s.name).join(", ") || "(none)"}  ` +
      `| ${ALL_SOURCES.filter((s) => s.status === "stub").length} OEM stubs registered`
  );
  let total = 0;
  for (const src of sources) {
    try {
      const records = await src.fetch();
      writeRaw(src.name, records);
      total += records.length;
      console.log(`  [${src.name}] wrote ${records.length} raw records`);
    } catch (err) {
      console.error(`  [${src.name}] FAILED: ${err instanceof Error ? err.message : err}`);
      writeRaw(src.name, []); // keep the run resumable
    }
  }
  console.log(`  ingest total: ${total} raw records`);
  return total;
}

function normalize(): { rawCount: number; normalized: number } {
  banner("NORMALIZE");
  const raws = readAllRaw();
  const now = nowIso();
  const masters = raws.map((r) => toMaster(r, now)).filter((m): m is NonNullable<typeof m> => m !== null);
  const collapsed = collapseExact(masters);
  replaceAll(collapsed);
  console.log(`  ${raws.length} raw → ${masters.length} valid → ${collapsed.length} after exact-key collapse`);
  return { rawCount: raws.length, normalized: collapsed.length };
}

function dedupe(): { before: number; after: number; removed: number } {
  banner("DEDUPE");
  const rows = loadAll();
  const { merged, removed } = dedupeRecords(rows);
  replaceAll(merged);
  console.log(`  ${rows.length} → ${merged.length} rooftops (${removed} duplicates merged)`);
  return { before: rows.length, after: merged.length, removed };
}

async function validate(): Promise<void> {
  banner("VALIDATE");
  const { phoneChecked, websiteChecked } = await runValidate();
  console.log(`  phone checked: ${phoneChecked}, websites probed: ${websiteChecked}`);
}

async function enrich(): Promise<void> {
  banner("ENRICH");
  const { attempted, withContacts, totalContacts, withTools } = await runEnrich();
  console.log(`  enriched ${withContacts}/${attempted} accounts · ${totalContacts} contacts · ${withTools} tech stacks`);
}

async function places(): Promise<void> {
  banner("GOOGLE PLACES CROSS-CONFIRM");
  await runGooglePlaces();
}

function resolve(): void {
  banner("ENTITY RESOLUTION");
  runResolve();
}

function provenance(): void {
  banner("PROVENANCE / TRUST TIERS");
  const { tiers } = runProvenance();
  console.log(`  platinum ${tiers.platinum} · gold ${tiers.gold} · silver ${tiers.silver} · flagged ${tiers.flagged}`);
}

function benchmark(): void {
  runBenchmark();
}

function tier(): void {
  banner("TIER");
  const { tierA, tierB } = runTier();
  console.log(`  Tier A: ${tierA}, Tier B: ${tierB}`);
}

function exportCsv(): void {
  banner("EXPORT");
  const { path, rows } = runExport();
  console.log(`  wrote ${rows} rows → ${path}`);
}

async function all(): Promise<void> {
  const t0 = Date.now();
  await ingest();
  const { rawCount } = normalize();
  dedupe();
  await validate();
  await places(); // cross-confirm (no-op without GOOGLE_PLACES_API_KEY)
  resolve(); // entity resolution across all sources
  provenance(); // sources[] + confirmation_count + trust_tier
  tier();
  exportCsv();
  const finalCount = countRows();
  runReport({ removedByDedupe: Math.max(0, rawCount - finalCount) });
  benchmark();
  console.log(`✓ pipeline:all complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

const HELP = `Usage: tsx pipeline/run.ts <ingest|normalize|dedupe|validate|enrich|places|provenance|tier|export|report|benchmark|all>`;

async function main() {
  const cmd = (process.argv[2] ?? "all").toLowerCase();
  switch (cmd) {
    case "ingest": await ingest(); break;
    case "normalize": normalize(); break;
    case "dedupe": dedupe(); break;
    case "validate": await validate(); break;
    case "enrich": await enrich(); break;
    case "places": await places(); break;
    case "meta": await runMetaAds(); break;
    case "resolve": resolve(); break;
    case "provenance": provenance(); break;
    case "tier": tier(); break;
    case "export": exportCsv(); break;
    case "report": runReport(); break;
    case "benchmark": benchmark(); break;
    case "hubspot": await runHubspot((process.argv[3] ?? "pull").toLowerCase()); break;
    case "zoominfo": await runZoomInfo(); break;
    case "all": await all(); break;
    case "help": case "-h": case "--help": console.log(HELP); break;
    default:
      console.error(`Unknown command: ${cmd}\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
