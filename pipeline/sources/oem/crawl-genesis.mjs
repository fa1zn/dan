/*
 * GENESIS OEM SPINE CRAWLER (CA/TX/FL MVP) — Genesis is Hyundai's luxury arm and runs a
 * Hyundai-style locator on its own host: www.genesis.com/bin/api/v2/dealers?zip=. Returns
 * dealerCd (code, e.g. "CA739"), dealerNm, address1, city, zipCd, state, phone, latitude,
 * longitude, dealerUrl. Match existing by geo (~400m) then phone → Platinum. INSERT net-new CA/TX/FL only.
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
// Genesis has few rooftops; a modest spread of CA/TX/FL metro zips + dealerCd dedup covers all.
const ZIPS = ["90210","90802","92101","92501","93101","93701","94102","95814","95350","92801","77001","75201","78701","76102","79901","78205","78401","77840","76701","33101","33186","32801","33602","32202","33301","33401","34236","32601","33801"];

async function main() {
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");
  console.log(`\n▶ GENESIS OEM CRAWL (CA/TX/FL) — ${ZIPS.length} zip anchors`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.genesis.com/us/en/retailer-locator", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000);

  const byCode = new Map();
  for (let i = 0; i < ZIPS.length; i++) {
    try {
      const dealers = await page.evaluate(async (zip) => {
        const r = await fetch(`https://www.genesis.com/bin/api/v2/dealers?zip=${zip}`, { headers: { Accept: "application/json" } });
        if (!r.ok) return { _status: r.status };
        const j = await r.json();
        return (j.result && j.result.dealers) || [];
      }, ZIPS[i]);
      if (dealers._status) { if (i < 3) console.log(`  ! zip ${ZIPS[i]} HTTP ${dealers._status}`); }
      else for (const d of dealers) if (d.dealerCd && !byCode.has(d.dealerCd)) byCode.set(d.dealerCd, d);
    } catch (e) { console.error(`  ! zip ${ZIPS[i]}: ${String(e.message).slice(0, 80)}`); }
    if ((i + 1) % 10 === 0 || i === ZIPS.length - 1) console.log(`  [${i + 1}/${ZIPS.length}] unique Genesis dealers: ${byCode.size}`);
    await sleep(700);
  }
  await browser.close();

  const existing = db.prepare("SELECT id, name, city, phone, latitude, longitude FROM dealerships WHERE oem='Genesis'").all();
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
  const near = (la, ln) => existing.find((e) => e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);

  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum', phone=COALESCE(phone,@phone), website=COALESCE(website,@web),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip),
      latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
      source=CASE WHEN source LIKE '%oem:genesis%' THEN source ELSE source||'+oem:genesis' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,'Genesis',@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@web,'oem:genesis',1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

  let confirmed = 0, inserted = 0;
  for (const d of byCode.values()) {
    const state = d.state;
    const lat = d.latitude != null ? +d.latitude : null, lng = d.longitude != null ? +d.longitude : null;
    const phone = fmtPhone(d.phone);
    const web = d.dealerUrl ? `https://${String(d.dealerUrl).replace(/^https?:\/\//, "")}` : null;
    const m = (lat != null && near(lat, lng)) || (phone && byPhone.get(digits(phone)));
    if (m) { upd.run({ id: m.id, code: d.dealerCd, phone, web, street: d.address1 || null, zip: d.zipCd || null, lat, lng }); confirmed++; }
    else if (!ALLOW.has(state)) { /* border bleed — skip net-new outside MVP states */ }
    else {
      try { ins.run({ name: d.dealerNm, street: d.address1 || null, city: d.city || null, state, zip: d.zipCd || null, territory: REGION[state] || "US-Other", lat, lng, phone, web, code: d.dealerCd, dedup: `genesis|${d.dealerCd}` }); inserted++; }
      catch { /* dup */ }
    }
  }
  console.log(`\n  ✓ Genesis: ${byCode.size} pulled → ${confirmed} upgraded, ${inserted} net-new — all Platinum (dealer codes)`);
  console.log(`  Genesis CA/TX/FL manufacturer-confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem='Genesis' AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get().n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
