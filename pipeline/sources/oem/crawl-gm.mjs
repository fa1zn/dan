/*
 * GM OEM CRAWL (CA/TX/FL) — Chevrolet, Buick, GMC, Cadillac all share ONE dealer-locator
 * platform ("quantum"). Single same-origin endpoint on chevrolet.com:
 *   GET /bypass/pcf/quantum-dealer-locator/v1/getDealers
 *       ?desiredCount=50&distance=500&makeCodes=<code>&serviceCodes=&latitude=<la>&longitude=<ln>&searchType=latLongSearch
 *   headers: clientapplicationid: quantum, locale: en-US, Content-Type: application/json
 * makeCodes: Chevrolet=001, Buick=004, Cadillac=006, GMC=012 (extracted from the quantum bundle).
 * The server caps at 50 results / ~106 mi radius per call, so we sweep a lat/lng grid over CA/TX/FL
 * per brand and dedup by BAC. Dealer objects carry: dealerName, bac (DEALER CODE), address
 * (countrySubdivisionCode=state, addressLine1, cityName, postalCode), geolocation.lat/lng,
 * generalContact.phone1, dealerUrl. Match existing rows by geo then phone -> Platinum w/ bac. In-page
 * fetch on chevrolet.com clears the bot-wall. INSERT net-new only for CA/TX/FL.
 */
import { chromium } from "playwright-core";
import Database from "better-sqlite3";

const ROOT = new URL("../../../", import.meta.url);
const DB = new URL("data/dealerships.sqlite", ROOT).pathname;
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const ALLOW = new Set(["CA", "TX", "FL"]);
const REGION = { CA: "US-West", TX: "US-South", FL: "US-South" };
const digits = (p) => (p || "").replace(/\D/g, "").slice(-10);
const fmtPhone = (p) => { const d = digits(p); return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : (p || null); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BRANDS = [
  { oem: "Chevrolet", makeCode: "001" },
  { oem: "Buick",     makeCode: "004" },
  { oem: "Cadillac",  makeCode: "006" },
  { oem: "GMC",       makeCode: "012" },
];

// lat/lng grid anchors (~1.4deg / ~100mi spacing) covering CA, TX, FL. Each call pulls <=50 within ~106mi.
const GRID = [
  // California
  [41.8,-124.0],[41.5,-122.4],[40.6,-122.4],[39.5,-123.8],[39.2,-121.5],[38.6,-121.5],[38.0,-122.4],[37.3,-121.9],[37.0,-120.0],
  [36.7,-119.8],[36.6,-121.9],[35.4,-119.0],[35.3,-120.7],[34.9,-117.0],[34.4,-119.7],[34.05,-118.24],[34.1,-117.3],[33.7,-116.2],
  [33.7,-117.8],[32.7,-117.1],[32.8,-115.5],[33.8,-114.6],[36.2,-115.9],[39.3,-120.0],[40.8,-121.5],
  // Texas
  [36.0,-102.0],[34.2,-101.8],[32.4,-99.7],[33.6,-101.9],[31.8,-102.4],[29.8,-104.0],[31.5,-100.4],[30.3,-97.7],[29.4,-98.5],
  [29.76,-95.36],[29.3,-94.8],[28.0,-97.4],[27.5,-99.5],[26.2,-98.2],[25.9,-97.5],[31.6,-96.5],[32.8,-96.8],[33.2,-97.1],
  [32.5,-94.7],[30.1,-94.1],[30.6,-96.3],[31.1,-97.7],[35.2,-97.5],
  // Florida
  [30.4,-87.2],[30.4,-86.6],[30.3,-84.3],[30.2,-82.6],[29.7,-84.9],[29.2,-81.0],[28.5,-81.4],[28.0,-82.5],[27.3,-80.4],
  [26.7,-80.1],[26.1,-81.8],[26.1,-80.2],[25.8,-80.2],[24.7,-81.4],[27.8,-82.6],[29.6,-82.3],[30.1,-81.6],[27.0,-82.0],
];

async function main() {
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");

  console.log(`\n▶ GM OEM CRAWL (CA/TX/FL) — quantum locator, 4 brands, ${GRID.length}-anchor grid/brand`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.chevrolet.com/dealer-locator", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000);

  const pull = (makeCode, la, ln) => page.evaluate(async ([mc, lat, lng]) => {
    const url = `https://www.chevrolet.com/bypass/pcf/quantum-dealer-locator/v1/getDealers?desiredCount=50&distance=500&makeCodes=${mc}&serviceCodes=&latitude=${lat}&longitude=${lng}&searchType=latLongSearch`;
    const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", clientapplicationid: "quantum", locale: "en-US" });
    try { const r = await fetch(url, { method: "GET", headers, cache: "no-cache" }); if (!r.ok) return { _status: r.status }; return (await r.json())?.payload?.dealers || []; }
    catch (e) { return { _err: String(e).slice(0, 80) }; }
  }, [makeCode, la, ln]);

  let grandConfirmed = 0, grandInserted = 0;
  for (const { oem, makeCode } of BRANDS) {
    const byBac = new Map();
    for (let i = 0; i < GRID.length; i++) {
      const [la, ln] = GRID[i];
      const res = await pull(makeCode, la, ln);
      if (res._status) { if (i < 3) console.log(`  ! ${oem} anchor ${i} HTTP ${res._status}`); }
      else if (res._err) { console.log(`  ! ${oem} anchor ${i} ${res._err}`); }
      else for (const d of res) if (d.bac && ALLOW.has(d.address?.countrySubdivisionCode) && !byBac.has(d.bac)) byBac.set(d.bac, d);
      await sleep(250);
    }
    console.log(`\n  ${oem} (make ${makeCode}): ${byBac.size} unique CA/TX/FL rooftops pulled`);

    const existing = db.prepare("SELECT id, name, phone, latitude, longitude FROM dealerships WHERE oem=?").all(oem);
    const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
    const usedIds = new Set();
    const near = (la, ln) => existing.find((e) => !usedIds.has(e.id) && e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);

    const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum',
        phone=COALESCE(phone,@phone), address_street=COALESCE(address_street,@street), city=COALESCE(city,@city),
        postal_code=COALESCE(postal_code,@zip), website=COALESCE(website,@web),
        latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
        source=CASE WHEN source LIKE '%oem:gm%' THEN source ELSE source||'+oem:gm' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
    const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
        VALUES (@name,@oem,@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@web,'oem:gm',1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

    let confirmed = 0, inserted = 0;
    for (const d of byBac.values()) {
      const a = d.address || {};
      const state = a.countrySubdivisionCode;
      const lat = d.geolocation?.latitude ?? null, lng = d.geolocation?.longitude ?? null;
      const phone = fmtPhone(d.generalContact?.phone1);
      const web = d.dealerUrl || null;
      const m = (lat != null && near(lat, lng)) || (phone && [...byPhone.entries()].length && (() => { const e = byPhone.get(digits(phone)); return e && !usedIds.has(e.id) ? e : null; })());
      if (m) { usedIds.add(m.id); upd.run({ id: m.id, code: d.bac, phone, street: a.addressLine1 || null, city: a.cityName || null, zip: a.postalCodeFormatted || a.postalCode || null, web, lat, lng }); confirmed++; }
      else { try { ins.run({ name: d.dealerName || "GM Dealer", oem, street: a.addressLine1 || null, city: a.cityName || null, state, zip: a.postalCodeFormatted || a.postalCode || null, territory: REGION[state] || "US-Other", lat, lng, phone, web, code: d.bac, dedup: `gm|${oem.toLowerCase()}|${d.bac}` }); inserted++; } catch {} }
    }
    console.log(`  ✓ ${oem}: ${confirmed} upgraded, ${inserted} net-new`);
    grandConfirmed += confirmed; grandInserted += inserted;
  }
  await browser.close();

  console.log(`\n  === GM TOTAL: ${grandConfirmed} upgraded, ${grandInserted} net-new — all Platinum (BAC codes) ===`);
  for (const { oem } of BRANDS) {
    const n = db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem=? AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get(oem).n;
    console.log(`  ${oem} CA/TX/FL manufacturer-confirmed: ${n}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
