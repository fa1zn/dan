/*
 * NEON SYNC — mirror the canonical SQLite dealerships table into the user's Neon Postgres.
 * Full replace each run (create table + truncate + batch insert), so it's idempotent and
 * re-runnable. Credential read from .env (NEON_DATABASE_URL), never hardcoded.
 *
 *   node pipeline/integrations/neon-sync.mjs
 */
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import pg from "pg";

// --- read NEON_DATABASE_URL from .env (no dotenv dependency) ---
const env = {};
for (const line of readFileSync(new URL("../../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL_ = env.NEON_DATABASE_URL;
if (!URL_) { console.error("NEON_DATABASE_URL missing from .env"); process.exit(1); }

// Columns to mirror (the meaningful ones a rep / app / BI query needs).
const COLS = [
  "id", "name", "oem", "dealer_code", "brand_confirmed", "trust_tier", "confirmation_count",
  "address_street", "city", "state_province", "postal_code", "country", "territory",
  "latitude", "longitude", "phone", "website", "domain", "source", "place_id",
  "hs_in_crm", "hs_owner", "hs_lifecycle_stage",
  "enrichment", "contacts", "tools_used", // signals + decision-makers (the copilot fuel)
  "created_at", "updated_at",
];
const DDL = `CREATE TABLE IF NOT EXISTS dealerships (
  id integer PRIMARY KEY,
  name text, oem text, dealer_code text,
  brand_confirmed boolean, trust_tier text, confirmation_count integer,
  address_street text, city text, state_province text, postal_code text,
  country text, territory text,
  latitude double precision, longitude double precision,
  phone text, website text, domain text, source text, place_id text,
  hs_in_crm boolean, hs_owner text, hs_lifecycle_stage text,
  enrichment text, contacts text, tools_used text,
  created_at text, updated_at text
)`;

async function main() {
  const db = new Database(new URL("../../data/dealerships.sqlite", import.meta.url).pathname, { readonly: true });
  const rows = db.prepare(`SELECT ${COLS.join(",")} FROM dealerships`).all();
  console.log(`read ${rows.length} rows from canonical SQLite`);

  const client = new pg.Client({ connectionString: URL_.replace(/\?.*/, ""), ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("connected to Neon");

  await client.query("DROP TABLE IF EXISTS dealerships"); // full-replace mirror — recreate with current schema
  await client.query(DDL);
  await client.query("CREATE INDEX IF NOT EXISTS dealerships_oem_idx ON dealerships(oem)");
  await client.query("CREATE INDEX IF NOT EXISTS dealerships_state_idx ON dealerships(country, state_province)");
  await client.query("CREATE INDEX IF NOT EXISTS dealerships_confirmed_idx ON dealerships(brand_confirmed)");
  await client.query("TRUNCATE dealerships");

  const bool = (v) => (v == null ? null : v === 1 || v === true);
  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = [];
    const tuples = chunk.map((r, ri) => {
      const base = ri * COLS.length;
      const vals = COLS.map((c) => {
        let v = r[c];
        if (c === "brand_confirmed" || c === "hs_in_crm") v = bool(v);
        return v;
      });
      values.push(...vals);
      return `(${COLS.map((_, ci) => `$${base + ci + 1}`).join(",")})`;
    });
    await client.query(`INSERT INTO dealerships (${COLS.join(",")}) VALUES ${tuples.join(",")}`, values);
    done += chunk.length;
    if (done % 5000 < BATCH) console.log(`  inserted ${done}/${rows.length}`);
  }

  const q = async (s) => (await client.query(s)).rows[0].n;
  console.log(`\n✓ synced ${done} rows to Neon`);
  console.log(`  Neon dealerships total:  ${await q("SELECT COUNT(*) n FROM dealerships")}`);
  console.log(`  manufacturer-confirmed:  ${await q("SELECT COUNT(*) n FROM dealerships WHERE brand_confirmed=true")}`);
  console.log(`  US:                      ${await q("SELECT COUNT(*) n FROM dealerships WHERE country='US' AND brand_confirmed=true")}`);
  console.log(`  Canada:                  ${await q("SELECT COUNT(*) n FROM dealerships WHERE country='CA' AND brand_confirmed=true")}`);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
