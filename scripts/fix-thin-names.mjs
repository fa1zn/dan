// Repair thin/brand-only rooftop names ("Audi") using the Google business name
// already captured in places_cache (found=1 rows are distance-gated, so the entity
// is confirmed at the rooftop's location). Safe: skips co-located service/detail
// sub-listings, requires the brand to match, and preserves the original name.
//   node scripts/fix-thin-names.mjs           # dry run (default)
//   node scripts/fix-thin-names.mjs --apply
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const db = new Database(new URL("../data/dealerships.sqlite", import.meta.url).pathname);

// Reversibility: stash the original name once.
const cols = new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name));
if (!cols.has("name_original")) db.exec("ALTER TABLE dealerships ADD COLUMN name_original TEXT");

const BRAND = /(audi|bmw|toyota|honda|ford|chevrolet|chevy|nissan|lexus|kia|hyundai|subaru|mazda|volkswagen|vw|jeep|dodge|ram|chrysler|gmc|buick|cadillac|acura|infiniti|genesis|porsche|volvo|lincoln|mitsubishi|mini|jaguar|land rover|maserati|fiat|alfa romeo|bentley|rolls|aston|mclaren|lamborghini|ferrari|lotus|polestar|rivian|lucid|tesla)/i;
// Co-located sub-listings Google sometimes returns instead of the dealership.
const NOISE = /(service|parts|body shop|bodyshop|collision|detail|car wash|express|quick lane|oil|tire|smog|glass|leasing|rental|powersports|motorcycle|marine|\brv\b|wholesale|used car|pre-owned only|buy center)/i;

const rows = db.prepare(`
  SELECT d.id, d.name AS db, p.display_name AS g
  FROM dealerships d JOIN places_cache p ON p.dealership_id = d.id
  WHERE p.found = 1 AND p.display_name IS NOT NULL AND (d.name_original IS NULL)`).all();

const norm = (s) => s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");

let candidates = 0, skippedNoise = 0, skippedBrand = 0, examples = [];
const updates = [];
for (const r of rows) {
  const dbName = r.db.trim();
  const g = (r.g || "").trim();
  const words = dbName.split(/\s+/).length;
  const isThin = words <= 2 || BRAND.test(dbName) && norm(dbName).split(" ").every((w) => BRAND.test(w));
  if (!isThin) continue;
  if (norm(g) === norm(dbName) || !g) continue;
  if (g.split(/\s+/).length <= words) continue;        // not richer
  if (NOISE.test(g)) { skippedNoise++; continue; }     // service/detail sub-listing
  const dbBrand = (dbName.match(BRAND) || [])[0];
  if (dbBrand && !new RegExp(dbBrand, "i").test(g)) { skippedBrand++; continue; } // brand must match
  candidates++;
  updates.push({ id: r.id, from: dbName, to: g });
  if (examples.length < 15) examples.push(`  "${dbName}" → "${g}"`);
}

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — thin-name repairs`);
console.log(`candidates: ${candidates} · skipped (service/detail noise): ${skippedNoise} · skipped (brand mismatch): ${skippedBrand}`);
console.log(examples.join("\n"));

if (APPLY && updates.length) {
  const stmt = db.prepare("UPDATE dealerships SET name_original = name, name = @to, updated_at = CURRENT_TIMESTAMP WHERE id = @id");
  const tx = db.transaction((rows) => rows.forEach((u) => stmt.run(u)));
  tx(updates);
  console.log(`\nApplied ${updates.length} renames (original preserved in name_original).`);
} else if (!APPLY) {
  console.log(`\nDry run only. Re-run with --apply to write ${candidates} renames.`);
}
