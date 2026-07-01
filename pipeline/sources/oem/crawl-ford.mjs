/*
 * FORD OEM SPINE CRAWLER (CA/TX/FL MVP) — Ford's locator API is token-gated: it requires
 * a static `application-id` header (captured from the page). Returns PACode (dealer code),
 * name, address, phone, lat/lng. We load ford.com first (cookies/Akamai), then call the
 * endpoint per zip with the header. Match existing by geo, then phone. Platinum.
 */
import { chromium } from "playwright-core";
import Database from "better-sqlite3";

const ROOT = new URL("../../../", import.meta.url);
const DB = new URL("data/dealerships.sqlite", ROOT).pathname;
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const APP_ID = "07152898-698b-456e-be56-d3d83011d0a6"; // Ford dealer-service app key (from page)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALLOW = new Set(["CA", "TX", "FL"]);
const digits = (p) => (p || "").replace(/\D/g, "").slice(-10);
const REGION = { CA: "US-West", TX: "US-South", FL: "US-South" };

const ZIPS = [
  "90001","90210","91401","90802","92101","92020","92501","92262","93101","93301","93701","93901","94102","94601","95110","95202","95814","95401","95926","96001","95501","92801","94954","93534","95350","96150",
  "77001","77479","75201","75070","78701","78205","76102","79901","79401","79101","78401","78501","76701","75701","79701","77701","79601","78040","77840","75961","76301","78596","79912","77550",
  "33101","33186","32801","33602","32202","32301","33301","33401","33901","32501","32601","34236","32114","34102","34470","33801","34952","32962","32034","33040","32703","33510",
];

async function main() {
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");

  console.log(`\n▶ FORD OEM CRAWL (CA/TX/FL) — ${ZIPS.length} zip anchors`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.ford.com/dealerships/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000);

  const byCode = new Map();
  for (let i = 0; i < ZIPS.length; i++) {
    try {
      const dealers = await page.evaluate(async ([zip, appId]) => {
        const r = await fetch(`https://www.ford.com/cxservices/dealer/Dealers.json?make=Ford&radius=75&minDealers=1&maxDealers=100&postalCode=${zip}`, { headers: { Accept: "application/json", "application-id": appId, "x-requested-with": "XMLHttpRequest" } });
        if (!r.ok) return { _status: r.status };
        return (await r.json())?.Response?.Dealer || [];
      }, [ZIPS[i], APP_ID]);
      if (dealers._status) { if (i < 3) console.log(`  ! zip ${ZIPS[i]} HTTP ${dealers._status}`); }
      else for (const d of dealers) if (d.PACode && (d.dealerType === "Dealer" || !d.dealerType) && !byCode.has(d.PACode)) byCode.set(d.PACode, d);
    } catch (e) { console.error(`  ! zip ${ZIPS[i]}: ${String(e.message).slice(0, 80)}`); }
    if ((i + 1) % 20 === 0 || i === ZIPS.length - 1) console.log(`  [${i + 1}/${ZIPS.length}] unique Ford dealers: ${byCode.size}`);
    await sleep(700);
  }
  await browser.close();

  const existing = db.prepare("SELECT id, name, city, phone, latitude, longitude FROM dealerships WHERE oem='Ford'").all();
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
  const near = (la, ln) => existing.find((e) => e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);

  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, phone=COALESCE(phone,@phone),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip),
      latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
      source=CASE WHEN source LIKE '%oem:ford%' THEN source ELSE source||'+oem:ford' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,email,source,brand_confirmed,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,'Ford',@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@email,'oem:ford',1,@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

  let confirmed = 0, inserted = 0;
  for (const d of byCode.values()) {
    const a = d.Address || {};
    const state = a.State || a.state;
    if (!ALLOW.has(state)) continue;
    const lat = d.Latitude != null ? +d.Latitude : null, lng = d.Longitude != null ? +d.Longitude : null;
    const phone = d.Phone || null;
    const m = (lat != null && near(lat, lng)) || (phone && byPhone.get(digits(phone)));
    if (m) { upd.run({ id: m.id, code: d.PACode, phone, street: a.Street1 || null, zip: a.Zip || a.zip || null, lat, lng }); confirmed++; }
    else {
      try { ins.run({ name: d.Name, street: a.Street1 || null, city: a.City || a.city || null, state, zip: a.Zip || a.zip || null, territory: REGION[state] || "US-Other", lat, lng, phone, email: d.Email || null, code: d.PACode, dedup: `ford|${d.PACode}` }); inserted++; }
      catch { /* dup */ }
    }
  }
  console.log(`\n  ✓ Ford crawl done: ${byCode.size} pulled → ${confirmed} matched/upgraded, ${inserted} net-new — all brand_confirmed (Platinum)`);
  console.log(`  Ford CA/TX/FL now manufacturer-confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem='Ford' AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get().n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
