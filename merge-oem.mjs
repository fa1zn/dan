/*
 * MERGE OEM v2 — robust, idempotent fold of parallel-shell confirmations into canonical.
 * Fixes v1's two bugs: (1) it read only `source LIKE 'oem:%'` (net-new inserts), silently
 * dropping every UPGRADE row (source '...+oem:brand'); (2) it swallowed insert errors.
 * Here we take EVERY confirmed OEM row (brand_confirmed=1, dealer_code, source contains 'oem:')
 * for the brands the shells actually worked, and match into canonical by (oem+code) → (oem+geo)
 * → (oem+phone), else insert net-new for CA/TX/FL. Brand-scoped matching avoids CDJR
 * cross-brand phone collisions. ON CONFLICT(dedup_key) makes inserts idempotent + loud.
 */
import Database from "better-sqlite3";
import { readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";

const CANON = new URL("data/dealerships.sqlite", import.meta.url).pathname;
const db = new Database(CANON);
db.pragma("wal_checkpoint(TRUNCATE)"); // fold WAL into the main file so matching sees everything
const digits = (p) => (p || "").replace(/\D/g, "").slice(-10);
// National: accept net-new inserts for any US state/DC. Territory by Census region.
const CENSUS = {
  Northeast: ["CT","ME","MA","NH","RI","VT","NJ","NY","PA"],
  Midwest: ["IL","IN","MI","OH","WI","IA","KS","MN","MO","NE","ND","SD"],
  South: ["DE","FL","GA","MD","NC","SC","VA","DC","WV","AL","KY","MS","TN","AR","LA","OK","TX"],
  West: ["AZ","CO","ID","MT","NV","NM","UT","WY","AK","CA","HI","OR","WA"],
};
const REGION = {};
const ALLOW = new Set();
for (const [reg, sts] of Object.entries(CENSUS)) for (const s of sts) { REGION[s] = `US-${reg}`; ALLOW.add(s); }
// Canada: provinces/territories, region by grouping.
const CA_REGIONS = { West: ["BC","AB","SK","MB","YT","NT","NU"], Central: ["ON","QC"], East: ["NS","NB","NL","PE"] };
for (const [reg, provs] of Object.entries(CA_REGIONS)) for (const p of provs) { REGION[p] = `CA-${reg}`; ALLOW.add(p); }
// Every crawlable OEM brand (national confirm now spans all 50 states, not just CA/TX/FL).
const WORKER_BRANDS = new Set(["Toyota","Honda","Ford","Hyundai","Subaru","Mazda","Volkswagen","Chevrolet","GMC","Buick","Cadillac","Jeep","Chrysler","Dodge","Ram","Fiat","Alfa Romeo","Nissan","Kia","Infiniti","Mercedes-Benz","BMW","Mini","Lincoln","Acura","Mitsubishi","Lexus","Land Rover","Genesis","Jaguar"]);

const desktop = `${homedir()}/Desktop`;
const worktrees = readdirSync(desktop).filter((d) => d.startsWith("dan-shell-")).map((d) => `${desktop}/${d}/data/dealerships.sqlite`).filter(existsSync);
console.log(`\n▶ MERGE OEM v2 — folding ${worktrees.length} worktrees (upgrades + net-new) into canonical`);

// In-memory canonical index, grouped by oem, maintained as we go.
const canon = db.prepare("SELECT id, oem, dealer_code, phone, latitude, longitude FROM dealerships").all();
const byOem = new Map();
const byCode = new Set(); // `${oem}|${code}` already confirmed in canonical
for (const r of canon) {
  if (!byOem.has(r.oem)) byOem.set(r.oem, []);
  byOem.get(r.oem).push(r);
  if (r.dealer_code) byCode.add(`${r.oem}|${r.dealer_code}`);
}
const nearIn = (oem, la, ln) => la != null && (byOem.get(oem) || []).find((e) => e.latitude != null && !e._coded && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);
const phoneIn = (oem, ph) => ph && (byOem.get(oem) || []).find((e) => !e._coded && digits(e.phone) === digits(ph));

const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum',
    phone=COALESCE(phone,@phone), website=COALESCE(website,@web), address_street=COALESCE(address_street,@street),
    postal_code=COALESCE(postal_code,@zip), latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
    source=CASE WHEN source LIKE '%'||@src||'%' THEN source ELSE source||'+'||@src END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
    VALUES (@name,@oem,@street,@city,@state,@zip,@country,@territory,@lat,@lng,@phone,@web,@src,1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(dedup_key) DO UPDATE SET brand_confirmed=1, trust_tier='platinum', dealer_code=excluded.dealer_code,
      phone=COALESCE(dealerships.phone,excluded.phone), website=COALESCE(dealerships.website,excluded.website), updated_at=CURRENT_TIMESTAMP`);

let updated = 0, inserted = 0, already = 0, skippedOOS = 0;
const errs = [];
const run = db.transaction(() => {
  for (const path of worktrees) {
    const w = new Database(path, { readonly: true });
    const rows = w.prepare(`SELECT name, oem, dealer_code, address_street, city, state_province, postal_code, phone, latitude, longitude, website, country
        FROM dealerships WHERE brand_confirmed=1 AND dealer_code IS NOT NULL AND source LIKE '%oem:%'`).all();
    let lu = 0, li = 0;
    for (const r of rows) {
      if (!WORKER_BRANDS.has(r.oem)) continue;
      const key = `${r.oem}|${r.dealer_code}`;
      if (byCode.has(key)) { already++; continue; } // already confirmed in canonical
      const src = `oem:${r.oem.toLowerCase()}`;
      const m = nearIn(r.oem, r.latitude, r.longitude) || phoneIn(r.oem, r.phone);
      const args = { code: r.dealer_code, phone: r.phone, web: r.website, street: r.address_street, zip: r.postal_code, lat: r.latitude, lng: r.longitude, src };
      try {
        if (m) { upd.run({ ...args, id: m.id }); m._coded = true; byCode.add(key); lu++; updated++; }
        else if (ALLOW.has(r.state_province)) {
          const country = r.country || "US";
          ins.run({ ...args, name: r.name, oem: r.oem, city: r.city, state: r.state_province, country, territory: REGION[r.state_province] || (country === "CA" ? "CA-Other" : "US-Other"), dedup: `${r.oem.toLowerCase()}|${r.dealer_code}` });
          const row = { id: null, oem: r.oem, dealer_code: r.dealer_code, phone: r.phone, latitude: r.latitude, longitude: r.longitude, _coded: true };
          if (!byOem.has(r.oem)) byOem.set(r.oem, []); byOem.get(r.oem).push(row); byCode.add(key); li++; inserted++;
        } else skippedOOS++;
      } catch (e) { if (errs.length < 8) errs.push(`${r.oem} ${r.dealer_code}: ${e.message}`); }
    }
    console.log(`  ${path.split("/").slice(-3, -2)}: ${rows.length} confirmed OEM rows → ${lu} upgraded, ${li} net-new`);
    w.close();
  }
});
run();

const q = (s) => db.prepare(s).get().n;
console.log(`\n  ✓ merged: ${updated} upgraded, ${inserted} net-new, ${already} already-present, ${skippedOOS} out-of-state-no-match`);
if (errs.length) console.log(`  ⚠ insert errors (first ${errs.length}):\n    ` + errs.join("\n    "));
console.log(`  CA/TX/FL now: ${q("SELECT COUNT(*) n FROM dealerships WHERE state_province IN ('CA','TX','FL') AND trust_tier='platinum'")} Platinum · ${q("SELECT COUNT(*) n FROM dealerships WHERE state_province IN ('CA','TX','FL') AND brand_confirmed=1")} manufacturer-confirmed`);
