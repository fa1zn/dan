/*
 * Tech & lead-tooling fingerprint — evidence-backed buying signals off each dealer's own site.
 *
 *   tsx pipeline/enrich/fingerprint-cli.ts --id 14277
 *   tsx pipeline/enrich/fingerprint-cli.ts --name "Germain Honda"
 *   tsx pipeline/enrich/fingerprint-cli.ts --sample 8
 *
 * Prints what was found (with the marker that proves it) + the "why Pam fits" angle, and
 * persists to dealerships.enrichment.techSignals. No paid APIs; reads the rooftop's homepage.
 */
import "../lib/load-env";
import { getSqlite } from "../../lib/db";
import { fingerprintSite } from "./fingerprint";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface Row {
  id: number;
  name: string;
  website: string;
  enrichment: string | null;
}

function pick(): Row[] {
  const db = getSqlite();
  const id = arg("--id");
  const name = arg("--name");
  const sample = Number(arg("--sample")) || 5;
  const base = "SELECT id, name, website, enrichment FROM dealerships WHERE website IS NOT NULL AND website <> ''";
  if (id) return db.prepare(`${base} AND id = ?`).all(Number(id)) as Row[];
  if (name) return db.prepare(`${base} AND name LIKE ? LIMIT 1`).all(`%${name}%`) as Row[];
  return db.prepare(`${base} ORDER BY id LIMIT ?`).all(sample) as Row[];
}

function persist(row: Row, detections: unknown, angles: string[]) {
  const db = getSqlite();
  let enrichment: Record<string, unknown> = {};
  try {
    enrichment = JSON.parse(row.enrichment || "{}");
  } catch {
    enrichment = {};
  }
  enrichment.techSignals = detections;
  enrichment.pamAngles = angles;
  db.prepare("UPDATE dealerships SET enrichment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    JSON.stringify(enrichment),
    row.id
  );
}

async function main() {
  const rows = pick();
  if (!rows.length) {
    console.error("No rooftop with a website matched. Use --id, --name, or --sample.");
    process.exit(1);
  }
  for (const row of rows) {
    const r = await fingerprintSite(row.website);
    console.log(`\n${row.name}  ·  ${row.website}`);
    if (!r.ok) {
      console.log(`  (could not read: ${r.error ?? `HTTP ${r.status}`})`);
      continue;
    }
    if (!r.detections.length) {
      console.log("  no known lead-tooling detected on the homepage.");
    } else {
      console.log("  Detected:");
      for (const d of r.detections) console.log(`    · ${d.category.padEnd(18)} ${d.vendor.padEnd(22)} ← "${d.evidence}"`);
    }
    if (r.angles.length) {
      console.log("  Why Pam fits:");
      for (const a of r.angles) console.log(`    → ${a.angle}`);
    }
    persist(row, r.detections, r.angles.map((a) => a.angle));
    // Be polite between sites.
    await new Promise((res) => setTimeout(res, 600));
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
