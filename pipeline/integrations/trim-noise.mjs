/*
 * NOISE TRIM — flag (never delete) the rows that inflate the CA/TX/FL count above the real
 * ~3,600 franchises: Mexico-border mislabels, non-dealership entities, powersports/marine,
 * and single-source used-lots. Quality-first guards: NEVER flag a manufacturer-confirmed
 * (brand_confirmed=1) rooftop, and only flag a Gold rooftop if it's a HARD non-car entity
 * (a powersports shop with a website is still not a car franchise). Dry-run by default.
 */
import Database from "better-sqlite3";
const DB = new URL("../../data/dealerships.sqlite", import.meta.url).pathname;
const db = new Database(DB);
const APPLY = ["1", "true"].includes((process.env.TRIM_APPLY ?? "").toLowerCase());
const W = "state_province IN ('CA','TX','FL') AND brand_confirmed=0 AND trust_tier!='flagged'";

// HARD: not a car franchise even with a website → flag regardless of tier.
const HARD = ["powersport","power sports","motorcycle","motorsport","marine","forklift","material handling","motor sales usa","regional office","corporate","parts center","collision center","body shop"," rv ","rv center","transmission","smog","glass","rental","car wash","u-haul","penske truck"];
// MEXICO: mislabeled, not in-state → flag regardless of tier.
const MX = ["tijuana","baja","mexicali","monterrey","juarez","cuauht","ensenada","rosarito","chihuahua"];
// SOFT: ambiguous → flag only if single-source Silver.
const SOFT = ["used cars","pre-owned","preowned","wholesale"," autos ","independent","buy here pay here"];

const like = (pats, extra = "") =>
  pats.map(() => `LOWER(name) LIKE ?`).join(" OR ") + (extra ? ` ${extra}` : "");

function flagSet(label, pats, tierGuard) {
  const sql = `SELECT id,name,oem,trust_tier FROM dealerships WHERE ${W} ${tierGuard} AND (${pats.map(() => "LOWER(name) LIKE ?").join(" OR ")})`;
  return db.prepare(sql).all(...pats.map((p) => `%${p}%`));
}

const mx = flagSet("mexico", MX, "");
const hard = flagSet("hard", HARD, "");
const soft = flagSet("soft", SOFT, "AND trust_tier='silver'");
// also flag .mx websites
const mxWeb = db.prepare(`SELECT id,name,oem,trust_tier FROM dealerships WHERE ${W} AND (website LIKE '%.mx/%' OR website LIKE '%.mx')`).all();

const all = new Map();
for (const r of [...mx, ...mxWeb, ...hard, ...soft]) all.set(r.id, r);
const list = [...all.values()];
const goldCaught = list.filter((r) => r.trust_tier === "gold");

console.log(`\n▶ NOISE TRIM (${APPLY ? "APPLY" : "DRY RUN"}) — CA/TX/FL`);
console.log(`  would flag: ${list.length}  (mexico ${mx.length + mxWeb.length} · hard-non-car ${hard.length} · soft-used ${soft.length})`);
console.log(`  ⚠ Gold rooftops caught (hard-non-car only, should be few): ${goldCaught.length}`);
console.log(`  sample:`);
list.slice(0, 14).forEach((r) => console.log(`    • ${r.name} (${r.oem}/${r.trust_tier})`));

if (APPLY) {
  const upd = db.prepare("UPDATE dealerships SET trust_tier='flagged', updated_at=CURRENT_TIMESTAMP WHERE id=?");
  const tx = db.transaction((ids) => ids.forEach((id) => upd.run(id)));
  tx(list.map((r) => r.id));
  const q = (s) => db.prepare(s).get().n;
  const tot = q("SELECT COUNT(*) n FROM dealerships WHERE state_province IN ('CA','TX','FL')");
  const working = q("SELECT COUNT(*) n FROM dealerships WHERE state_province IN ('CA','TX','FL') AND trust_tier!='flagged'");
  console.log(`\n  ✓ flagged ${list.length}. CA/TX/FL working count (noise excluded): ${working} of ${tot}  (target ~3,600)`);
}
