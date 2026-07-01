/*
 * UNIVERSAL WEBSITE CONFIRMATION — every real franchise has a brand-specific dealer site;
 * used lots don't. Works for ALL brands regardless of OEM site architecture (the SPA-locked
 * brands we can't API-scrape get confirmed here). For each sited rooftop: fetch the site,
 * require HTTP 200 + the brand name + a dealer keyword. On pass, add "website" as an
 * independent source → bumps confirmation_count → upgrades Silver→Gold. Honest: Platinum
 * stays reserved for manufacturer-confirmed (dealer code); website is a self-reported source.
 * Mexico (.mx / border) sites are flagged, not confirmed.
 */
import Database from "better-sqlite3";
const DB = new URL("../../data/dealerships.sqlite", import.meta.url).pathname;
const db = new Database(DB);
const CONC = 16;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const rows = db.prepare(
  `SELECT id, name, oem, website, source FROM dealerships
   WHERE state_province IN ('CA','TX','FL') AND website IS NOT NULL
     AND oem NOT IN ('Tesla','Rivian','Lucid') AND source NOT LIKE '%website%'`
).all();
console.log(`\n▶ WEBSITE CONFIRMATION — ${rows.length} sited rooftops to verify`);

const upd = db.prepare(
  `UPDATE dealerships SET website_valid=1,
     source = CASE WHEN source LIKE '%website%' THEN source ELSE source||'+website' END,
     confirmation_count = (LENGTH(source||'+website') - LENGTH(REPLACE(source||'+website','+','')) + 1),
     updated_at=CURRENT_TIMESTAMP WHERE id=@id`
);
const flag = db.prepare("UPDATE dealerships SET website_valid=0 WHERE id=@id");

async function check(r) {
  const mx = /\.mx(\/|$)|tijuana|mexicali|monterrey|juarez|sabinas/i.test(r.website);
  if (mx) return "mexico";
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 9000);
    const res = await fetch(r.website, { headers: { "User-Agent": UA }, signal: c.signal, redirect: "follow" });
    clearTimeout(t);
    if (!res.ok) return "down";
    const html = (await res.text()).toLowerCase();
    const brand = (r.oem || "").toLowerCase();
    const brandHit = brand && html.includes(brand);
    const dealerHit = /dealer|new vehicles|inventory|test drive|schedule service/.test(html);
    return brandHit && dealerHit ? "confirmed" : "nomatch";
  } catch { return "err"; }
}

let confirmed = 0, down = 0, nomatch = 0, mexico = 0, done = 0;
let cursor = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (cursor < rows.length) {
    const r = rows[cursor++];
    const v = await check(r);
    if (v === "confirmed") { upd.run({ id: r.id }); confirmed++; }
    else if (v === "mexico") { mexico++; }
    else if (v === "down" || v === "err") { down++; }
    else nomatch++;
    if (++done % 300 === 0) console.log(`  [${done}/${rows.length}] confirmed ${confirmed} · down ${down} · no-match ${nomatch}`);
  }
}));

// Recompute trust tiers honestly: Platinum = manufacturer-confirmed only; else 2+ sources = Gold.
const recompute = db.prepare(`UPDATE dealerships SET trust_tier = CASE
    WHEN trust_tier='flagged' THEN 'flagged'
    WHEN brand_confirmed=1 THEN 'platinum'
    WHEN confirmation_count >= 2 THEN 'gold'
    ELSE 'silver' END
  WHERE state_province IN ('CA','TX','FL')`);
recompute.run();

const q = (s) => db.prepare(s).get().n;
console.log(`\n  ✓ website pass: ${confirmed} confirmed · ${nomatch} no brand match · ${down} unreachable · ${mexico} Mexico (skipped)`);
console.log(`  CA/TX/FL tiers now → platinum ${q("SELECT COUNT(*) n FROM dealerships WHERE state_province IN ('CA','TX','FL') AND trust_tier='platinum'")} · gold ${q("SELECT COUNT(*) n FROM dealerships WHERE state_province IN ('CA','TX','FL') AND trust_tier='gold'")} · silver ${q("SELECT COUNT(*) n FROM dealerships WHERE state_province IN ('CA','TX','FL') AND trust_tier='silver'")}`);
