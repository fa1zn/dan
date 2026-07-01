/*
 * GROUND-TRUTH AUDIT — sample rooftops and independently verify each against Google's
 * CURRENT view: is it a real, operating car dealer at that location, or closed / wrong
 * type / gone? Produces a measured accuracy rate per trust tier. Read-only, ~$0.01.
 */
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const ROOT = new URL("../../", import.meta.url);
const env = readFileSync(new URL(".env", ROOT), "utf8");
const KEY = env.split("\n").find((l) => l.startsWith("GOOGLE_PLACES_API_KEY="))?.split("=")[1]?.trim();
const N = Number(process.env.AUDIT_N || 30);
const db = new Database(new URL("data/dealerships.sqlite", ROOT).pathname);

// Stratified sample across tiers, CA/TX/FL.
const pick = (tier, n) =>
  db.prepare(
    `SELECT id,name,oem,city,state_province,trust_tier,source FROM dealerships
     WHERE state_province IN ('CA','TX','FL') AND trust_tier=? ORDER BY RANDOM() LIMIT ?`
  ).all(tier, n);
const sample = [...pick("gold", Math.ceil(N / 2)), ...pick("silver", Math.floor(N / 2))];

async function verify(d) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "places.displayName,places.primaryType,places.businessStatus,places.formattedAddress" },
    body: JSON.stringify({ textQuery: `${d.name} ${d.city ?? ""} ${d.state_province}` }),
  });
  const j = await res.json().catch(() => ({}));
  const p = j.places?.[0];
  if (!p) return { verdict: "NOT_FOUND", note: "no Google match" };
  const status = p.businessStatus ?? "?";
  const type = p.primaryType ?? "?";
  const nm = (p.displayName?.text ?? "").toLowerCase();
  const nameMatch = d.name.toLowerCase().split(/\s+/).some((t) => t.length > 3 && nm.includes(t));
  if (status === "CLOSED_PERMANENTLY") return { verdict: "CLOSED", note: `${nm} permanently closed` };
  if (type === "car_dealer" && nameMatch) return { verdict: "CONFIRMED", note: `${type} · ${status}` };
  if (type === "car_dealer") return { verdict: "CONFIRMED_NAMEDIFF", note: `car_dealer but name differs: ${nm}` };
  return { verdict: "WRONG_TYPE", note: `${type} (not a dealer): ${nm}` };
}

const tally = {};
console.log(`\n▶ GROUND-TRUTH AUDIT — ${sample.length} rooftops, independently checked vs Google's live data\n`);
for (const d of sample) {
  const r = await verify(d);
  tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  const mark = r.verdict.startsWith("CONFIRMED") ? "✓" : r.verdict === "CLOSED" ? "✗" : "?";
  console.log(`  ${mark} [${d.trust_tier}] ${d.name} (${d.state_province}) — ${r.verdict}: ${r.note}`);
}
const confirmed = (tally.CONFIRMED ?? 0) + (tally.CONFIRMED_NAMEDIFF ?? 0);
console.log(`\n  ================ RESULT ================`);
console.log(`  CONFIRMED real operating dealer: ${confirmed}/${sample.length} = ${((100 * confirmed) / sample.length).toFixed(0)}%`);
console.log(`  breakdown:`, JSON.stringify(tally));
console.log(`  (CONFIRMED = Google shows an operating car_dealer at that location)`);
