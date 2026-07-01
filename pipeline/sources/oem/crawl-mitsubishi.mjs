/*
 * MITSUBISHI OEM SPINE CRAWLER (CA/TX/FL MVP) — Mitsubishi's own locator backend is a GraphQL
 * persisted query at www-graphql.prod.mipulse.co (operationName=searchDealer). The persisted
 * query won't run cold, but once the page auto-fires it on load the hash is registered for the
 * session — after that a direct in-page fetch with the same sha256Hash works. So: load the
 * locator, wait for the warm-up fire, then fetch per CA/TX/FL lat/lng anchor. Each dealer carries
 * dealershipMarketId = OEM DEALER CODE, plus name, phone.phoneNumber, and address
 * (line1=street, line2=city, line3=state, postalArea=zip, lat/lng).
 * Match existing by geo (~400m) then phone → Platinum. INSERT net-new CA/TX/FL only.
 */
import { chromium } from "playwright-core";
import Database from "better-sqlite3";

const ROOT = new URL("../../../", import.meta.url);
const DB = new URL("data/dealerships.sqlite", ROOT).pathname;
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const HASH = "509a0311cd943cae03ef78f5964463ab328bdf08d72411ee4de7e41e01e5c793";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALLOW = new Set(["CA", "TX", "FL"]);
const digits = (p) => (p == null ? "" : String(p)).replace(/\D/g, "").slice(-10);
const fmtPhone = (p) => { const d = digits(p); return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : (p ? String(p) : null); };
const REGION = { CA: "US-West", TX: "US-South", FL: "US-South" };
// lat/lng anchors across CA/TX/FL metros; radius 200 per anchor + dealer-code dedup covers all.
const ANCHORS = [
  [34.05, -118.24], [32.72, -117.16], [37.77, -122.42], [38.58, -121.49], [36.75, -119.77], [34.42, -119.70], [40.80, -124.16], // CA
  [29.76, -95.37], [32.78, -96.80], [30.27, -97.74], [29.42, -98.49], [31.76, -106.49], [27.80, -97.40], [32.35, -95.30], [33.58, -101.86], // TX
  [25.76, -80.19], [28.54, -81.38], [27.95, -82.46], [30.33, -81.66], [30.44, -84.28], [26.12, -80.14], [27.34, -82.53], [28.06, -82.42], // FL
];

async function main() {
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");
  console.log(`\n▶ MITSUBISHI OEM CRAWL (CA/TX/FL) — ${ANCHORS.length} lat/lng anchors (warmed persisted GraphQL)`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.mitsubishicars.com/car-dealerships-near-me", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(7000); // let the page auto-fire searchDealer → registers the persisted query for this session

  const byCode = new Map();
  for (let i = 0; i < ANCHORS.length; i++) {
    const [lat, lng] = ANCHORS[i];
    try {
      const dealers = await page.evaluate(async ([la, ln, hash]) => {
        const vars = { latitude: la, longitude: ln, service: "all", filters: null, radius: 200, market: "us", language: "en", path: "/us/en/car-dealerships-near-me" };
        const ext = { persistedQuery: { version: 1, sha256Hash: hash } };
        const u = `https://www-graphql.prod.mipulse.co/prod/graphql?operationName=searchDealer&variables=${encodeURIComponent(JSON.stringify(vars))}&extensions=${encodeURIComponent(JSON.stringify(ext))}`;
        const r = await fetch(u, { headers: { Accept: "application/json" } });
        if (!r.ok) return { _status: r.status };
        const j = await r.json();
        return (j?.data?.searchDealer) || [];
      }, [lat, lng, HASH]);
      if (dealers._status) { if (i < 3) console.log(`  ! anchor ${i} HTTP ${dealers._status}`); }
      else for (const d of dealers) { const code = d.dealershipMarketId != null ? String(d.dealershipMarketId) : null; if (code && !byCode.has(code)) byCode.set(code, d); }
    } catch (e) { console.error(`  ! anchor ${i}: ${String(e.message).slice(0, 70)}`); }
    if ((i + 1) % 7 === 0 || i === ANCHORS.length - 1) console.log(`  [${i + 1}/${ANCHORS.length}] unique Mitsubishi dealers: ${byCode.size}`);
    await sleep(700);
  }
  await browser.close();

  const existing = db.prepare("SELECT id, name, city, phone, latitude, longitude FROM dealerships WHERE oem='Mitsubishi'").all();
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
  const near = (la, ln) => existing.find((e) => e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);

  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum', phone=COALESCE(phone,@phone), website=COALESCE(website,@web),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip),
      latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
      source=CASE WHEN source LIKE '%oem:mitsubishi%' THEN source ELSE source||'+oem:mitsubishi' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,'Mitsubishi',@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@web,'oem:mitsubishi',1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

  let confirmed = 0, inserted = 0;
  for (const d of byCode.values()) {
    const a = d.address || {};
    const state = a.addressLine3;
    const lat = a.latitude != null ? +a.latitude : null, lng = a.longitude != null ? +a.longitude : null;
    const phone = fmtPhone(d.phone?.phoneNumber);
    const web = d.url || null;
    const m = (lat != null && near(lat, lng)) || (phone && byPhone.get(digits(phone)));
    if (m) { upd.run({ id: m.id, code: String(d.dealershipMarketId), phone, web, street: a.addressLine1 || null, zip: a.postalArea || null, lat, lng }); confirmed++; }
    else if (!ALLOW.has(state)) { /* border bleed — skip net-new outside MVP states */ }
    else {
      try { ins.run({ name: d.name, street: a.addressLine1 || null, city: a.addressLine2 || null, state, zip: a.postalArea || null, territory: REGION[state] || "US-Other", lat, lng, phone, web, code: String(d.dealershipMarketId), dedup: `mitsubishi|${d.dealershipMarketId}` }); inserted++; }
      catch { /* dup */ }
    }
  }
  console.log(`\n  ✓ Mitsubishi: ${byCode.size} pulled → ${confirmed} upgraded, ${inserted} net-new — all Platinum (dealer codes)`);
  console.log(`  Mitsubishi CA/TX/FL manufacturer-confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem='Mitsubishi' AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get().n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
