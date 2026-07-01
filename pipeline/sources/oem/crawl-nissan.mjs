/*
 * NISSAN OEM CRAWL (CA/TX/FL) — Nissan's dealer locator calls an AppSync GraphQL API:
 *   POST https://graphql.nissanusa.com/graphql   (header x-api-key: da2-3gadjirlkbfdzg7fiosg4tewl4)
 *   operation getDealersByLatLng(location{lat,lng}, size, radius) →
 *     { id (dealer code, e.g. "NNA6125"), name, address{addressLine1,city,stateCode,postalCode},
 *       phoneNumber, websiteURL, geolocation{latitude,longitude} }
 * Lat/lng grid over CA/TX/FL bounding boxes; each call returns up to `size` nearest dealers.
 * Load the locator page first (clears Akamai / seeds context), then fetch GraphQL from page ctx.
 * Dedup by id, filter to CA/TX/FL, match existing rows by geo→phone → Platinum.
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
const API_KEY = "da2-3gadjirlkbfdzg7fiosg4tewl4";
const STEP = Number(process.env.CRAWL_STEP || 1.1);

const MVP_BBOX = [
  { latMin: 32.4, latMax: 42.1, lngMin: -124.5, lngMax: -114.0 }, // CA
  { latMin: 25.8, latMax: 36.6, lngMin: -106.7, lngMax: -93.5 },  // TX
  { latMin: 24.4, latMax: 31.1, lngMin: -87.7, lngMax: -79.9 },   // FL
];
function grid(step) {
  const pts = [];
  for (const b of MVP_BBOX) for (let lat = b.latMin; lat <= b.latMax; lat += step) for (let lng = b.lngMin; lng <= b.lngMax; lng += step) pts.push([+lat.toFixed(3), +lng.toFixed(3)]);
  return pts;
}

const QUERY = `query getDealersByLatLng($market: Market!, $location: Geolocation!, $size: Int, $radius: Int, $isMarketingDealer: Boolean) {
  getDealersByLatLng(market: $market, location: $location, isMarketingDealer: $isMarketingDealer, size: $size, radius: $radius) {
    id
    name
    address { addressLine1 city state stateCode postalCode }
    phoneNumber
    websiteURL
    geolocation { latitude longitude }
  }
}`;

async function main() {
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");
  const pts = grid(STEP);
  console.log(`\n▶ NISSAN OEM CRAWL (CA/TX/FL) — ${pts.length} grid points (step ${STEP}°), GraphQL getDealersByLatLng`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.nissanusa.com/dealer-locator.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(4000); // seed Akamai / page context

  const byCode = new Map();
  for (let i = 0; i < pts.length; i++) {
    const [lat, lng] = pts[i];
    try {
      const dealers = await page.evaluate(async ({ lat, lng, apiKey, query }) => {
        const body = { operationName: "getDealersByLatLng", variables: { market: { lang: "en", region: "us", brand: "nissan", application: "inventory" }, location: { latitude: lat, longitude: lng }, size: 60, radius: 160, isMarketingDealer: false }, query };
        const r = await fetch("https://graphql.nissanusa.com/graphql", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey }, body: JSON.stringify(body) });
        if (!r.ok) return { _status: r.status };
        const j = await r.json();
        if (j.errors) return { _err: JSON.stringify(j.errors).slice(0, 200) };
        return j?.data?.getDealersByLatLng || [];
      }, { lat, lng, apiKey: API_KEY, query: QUERY });
      if (dealers._status) { if (i < 3) console.log(`  ! point ${i} HTTP ${dealers._status}`); }
      else if (dealers._err) { if (i < 3) console.log(`  ! point ${i} GQL err ${dealers._err}`); }
      else for (const d of dealers) if (d.id && !byCode.has(d.id)) byCode.set(d.id, d);
    } catch (e) { console.error(`  ! point ${i}: ${String(e.message).slice(0, 80)}`); }
    if ((i + 1) % 25 === 0 || i === pts.length - 1) console.log(`  [${i + 1}/${pts.length}] unique Nissan dealers: ${byCode.size}`);
    await sleep(500);
  }
  await browser.close();

  const existing = db.prepare("SELECT id, name, city, phone, latitude, longitude FROM dealerships WHERE oem='Nissan'").all();
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
  const near = (la, ln) => existing.find((e) => e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);
  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum', phone=COALESCE(phone,@phone),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip), website=COALESCE(website,@web),
      latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
      source=CASE WHEN source LIKE '%oem:nissan%' THEN source ELSE source||'+oem:nissan' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,'Nissan',@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@web,'oem:nissan',1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

  let confirmed = 0, inserted = 0;
  for (const d of byCode.values()) {
    const a = d.address || {};
    const st = a.stateCode || null;
    if (!ALLOW.has(st)) continue;
    const lat = d.geolocation?.latitude ?? null, lng = d.geolocation?.longitude ?? null;
    const phone = fmtPhone(d.phoneNumber);
    const web = d.websiteURL ? (/^https?:/i.test(d.websiteURL) ? d.websiteURL : `http://${d.websiteURL}`) : null;
    const m = (lat != null && near(lat, lng)) || (phone && byPhone.get(digits(phone)));
    if (m) { upd.run({ id: m.id, code: d.id, phone, street: (a.addressLine1 || "").trim() || null, zip: a.postalCode || null, web, lat, lng }); confirmed++; }
    else { try { ins.run({ name: d.name, street: (a.addressLine1 || "").trim() || null, city: a.city || null, state: st, zip: a.postalCode || null, territory: REGION[st] || "US-Other", lat, lng, phone, web, code: d.id, dedup: `nissan|${d.id}` }); inserted++; } catch {} }
  }
  console.log(`\n  ✓ Nissan: ${byCode.size} pulled → ${confirmed} upgraded, ${inserted} net-new — all Platinum (dealer codes)`);
  console.log(`  Nissan CA/TX/FL manufacturer-confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem='Nissan' AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get().n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
