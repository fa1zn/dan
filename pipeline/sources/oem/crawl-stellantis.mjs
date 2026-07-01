/*
 * STELLANTIS OEM CRAWL (CA/TX/FL) — ONE endpoint covers all six US brands.
 *
 * Endpoint (proof):
 *   https://www.jeep.com/bdlws/DealerLocator?brandCode=J&func=byGeo&zipCode=<ZIP>&radius=100&resultsPerPage=200
 *   (FIAT rooftops live on the fiatusa host: https://www.fiatusa.com/bdlws/DealerLocator?brandCode=X&...)
 *
 * The "bdlws" (Brand Dealer Locator Web Service) returns rooftop-level dealers with a REAL
 * dealerCode, name, address, state, lat/lng, phone, website, and a `brands` array.
 * Brand letters:  C=Chrysler  D=Dodge  J=Jeep  R=Ram  Y=Alfa Romeo  X=FIAT.
 * A single CDJR rooftop shows up in our DB as up to 4 brand rows (Jeep/Ram/Dodge/Chrysler)
 * sharing the same address+phone; we upgrade each brand row whose brand letter the rooftop carries.
 *
 * Match existing DB rows by geo (|dlat|<0.004 && |dlng|<0.004) then phone → brand_confirmed=1,
 * trust_tier='platinum', dealer_code=<code>. INSERT net-new ONLY for CA/TX/FL.
 */
import { chromium } from "playwright-core";
import Database from "better-sqlite3";

const ROOT = new URL("../../../", import.meta.url);
const DB = new URL("data/dealerships.sqlite", ROOT).pathname;
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALLOW = new Set(["CA", "TX", "FL"]);
const digits = (p) => (p || "").replace(/\D/g, "").slice(-10);
const fmtPhone = (p) => { const d = digits(p); return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : (p || null); };
const REGION = { CA: "US-West", TX: "US-South", FL: "US-South" };
const num = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : null; };

// Map a dealer's `brands` letters (+ name for FIAT) to our oem values.
const brandOf = (d) => {
  const set = new Set(d.brands || []);
  const out = [];
  if (set.has("J")) out.push("Jeep");
  if (set.has("R")) out.push("Ram");
  if (set.has("D")) out.push("Dodge");
  if (set.has("C")) out.push("Chrysler");
  if (set.has("Y")) out.push("Alfa Romeo");
  if (set.has("X") && /fiat/i.test(d.dealerName || "")) out.push("Fiat");
  return out;
};

// CA / TX / FL zip anchors (radius 100mi each → full state coverage w/ overlap-dedup by code).
const ZIPS = ["90001","90210","91401","90802","92101","92020","92501","92262","93101","93301","93701","93901","94102","94601","95110","95202","95814","95401","95926","96001","95501","92801","94954","93534","95350","96150",
  "77001","77479","75201","75070","78701","78205","76102","79901","79401","79101","78401","78501","76701","75701","79701","77701","79601","78040","77840","75961","76301","78596","79912","77550",
  "33101","33186","32801","33602","32202","32301","33301","33401","33901","32501","32601","34236","32114","34102","34470","33801","34952","32962","32034","33040","32703","33510"];

async function main() {
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");

  console.log(`\n▶ STELLANTIS OEM CRAWL (CA/TX/FL) — bdlws single service, all 6 brands, ${ZIPS.length} zip anchors`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });

  // The bdlws service is hosted per-brand-domain and CORS-locks cross-origin fetch, so we
  // must run each host's fetch from a page ON that host. brandCode does NOT filter results
  // (each host returns all nearby franchised rooftops); we rely on each dealer's `brands` array.
  //   jeep.com          → CDJR rooftops (C,D,J,R letters)
  //   fiatusa.com       → FIAT rooftops (X letter + "FIAT" in name)
  //   alfaromeousa.com  → Alfa Romeo rooftops (Y letter)
  const HOSTS = [
    { host: "https://www.jeep.com", code: "J" },
    { host: "https://www.fiatusa.com", code: "X" },
    { host: "https://www.alfaromeousa.com", code: "Y" },
  ];
  const byCode = new Map();
  const pull = async (host, brandCode, zip) => page.evaluate(async ({ host, brandCode, zip }) => {
    try {
      const r = await fetch(`${host}/bdlws/DealerLocator?brandCode=${brandCode}&func=byGeo&zipCode=${zip}&radius=100&resultsPerPage=200`, { headers: { Accept: "application/json" } });
      if (!r.ok) return { _status: r.status };
      const j = await r.json();
      return j.dealer || [];
    } catch (e) { return { _err: String(e).slice(0, 80) }; }
  }, { host, brandCode, zip });

  for (const { host, code } of HOSTS) {
    await page.goto(host + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(2500);
    console.log(`  — host ${host} (brandCode=${code})`);
    let added = 0;
    for (let i = 0; i < ZIPS.length; i++) {
      const z = ZIPS[i];
      try {
        const dealers = await pull(host, code, z);
        if (dealers._status || dealers._err) { if (i < 2) console.log(`    ! zip ${z}: ${dealers._status || dealers._err}`); }
        else for (const d of dealers) if (d.dealerCode && !byCode.has(d.dealerCode)) { byCode.set(d.dealerCode, d); added++; }
      } catch (e) { /* transient */ }
      await sleep(300);
    }
    console.log(`    +${added} new rooftops (running total ${byCode.size})`);
  }
  await browser.close();

  // Keep only rooftops in CA/TX/FL that carry at least one of our 6 brands.
  const rooftops = [...byCode.values()].filter((d) => ALLOW.has(d.dealerState) && brandOf(d).length);
  console.log(`  CA/TX/FL Stellantis rooftops with a target brand: ${rooftops.length}`);

  const BRANDS = ["Jeep", "Ram", "Dodge", "Chrysler", "Fiat", "Alfa Romeo"];
  const results = {};

  for (const brand of BRANDS) {
    const existing = db.prepare("SELECT id, name, city, phone, latitude, longitude FROM dealerships WHERE oem=?").all(brand);
    const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
    const usedIds = new Set();
    const near = (la, ln) => existing.find((e) => !usedIds.has(e.id) && e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);

    const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum', phone=COALESCE(phone,@phone),
        address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip), website=COALESCE(website,@web),
        latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
        source=CASE WHEN source LIKE '%oem:stellantis%' THEN source ELSE source||'+oem:stellantis' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
    const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
        VALUES (@name,@brand,@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@web,'oem:stellantis',1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

    let confirmed = 0, inserted = 0;
    for (const d of rooftops) {
      if (!brandOf(d).includes(brand)) continue;
      const lat = num(d.dealerShowroomLatitude), lng = num(d.dealerShowroomLongitude);
      const phone = fmtPhone(d.phoneNumber);
      const zip5 = (d.dealerZipCode || "").slice(0, 5) || null;
      const m = (lat != null && near(lat, lng)) || (phone && byPhone.get(digits(phone)) && !usedIds.has(byPhone.get(digits(phone)).id) ? byPhone.get(digits(phone)) : null);
      if (m) {
        usedIds.add(m.id);
        upd.run({ id: m.id, code: d.dealerCode, phone, street: d.dealerAddress1 || null, zip: zip5, web: d.website || null, lat, lng });
        confirmed++;
      } else {
        try {
          ins.run({ name: d.dealerName, brand, street: d.dealerAddress1 || null, city: d.dealerCity || null, state: d.dealerState, zip: zip5, territory: REGION[d.dealerState] || "US-Other", lat, lng, phone, web: d.website || null, code: d.dealerCode, dedup: `stellantis|${brand.toLowerCase().replace(/\s/g,'')}|${d.dealerCode}` });
          inserted++;
        } catch { /* dup dedup_key */ }
      }
    }
    const total = db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem=? AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get(brand).n;
    results[brand] = { confirmed, inserted, total };
    console.log(`  ✓ ${brand}: ${confirmed} upgraded, ${inserted} net-new → ${total} CA/TX/FL manufacturer-confirmed`);
  }

  // QA
  const dupCodes = db.prepare(`SELECT dealer_code, oem, COUNT(*) n FROM dealerships WHERE source LIKE '%oem:stellantis%' AND dealer_code IS NOT NULL GROUP BY dealer_code, oem HAVING n>1`).all();
  console.log(`\n  QA duplicate (dealer_code, brand) pairs: ${dupCodes.length}`);
  console.log(`  Sample confirmed rows:`);
  for (const r of db.prepare("SELECT name, oem, state_province, dealer_code, phone FROM dealerships WHERE source LIKE '%oem:stellantis%' AND brand_confirmed=1 ORDER BY RANDOM() LIMIT 5").all())
    console.log(`    [${r.oem}] ${r.name} (${r.state_province}) code=${r.dealer_code} ${r.phone || ''}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
