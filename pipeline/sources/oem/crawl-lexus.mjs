/*
 * LEXUS OEM SPINE CRAWLER (CA/TX/FL MVP) — Lexus is Toyota's luxury arm and runs the same
 * AEM dealer platform. Its own locator calls www.lexus.com/rest/lexus/dealers (same-origin,
 * zip-based). dealerSearchStrategy=expand returns ~15 nearest per zip (vs 2 for expandFallback),
 * so a spread of CA/TX/FL zip anchors + dealer-code dedup covers every rooftop.
 * Fields: id (DEALER CODE), dealerName, dealerAddress{address1,city,state,zipCode},
 * dealerLatitude/Longitude, dealerPhone, dealerEmail, dealerSiteUrl.
 * Match existing by geo (~400m) then phone → confirm/upgrade to Platinum; INSERT net-new CA/TX/FL only.
 */
import { chromium } from "playwright-core";
import Database from "better-sqlite3";

const ROOT = new URL("../../../", import.meta.url);
const DB = new URL("data/dealerships.sqlite", ROOT).pathname;
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALLOW = new Set(["CA", "TX", "FL"]);
const digits = (p) => (p || "").replace(/\D/g, "").slice(-10);
const REGION = { CA: "US-West", TX: "US-South", FL: "US-South" };
const ZIPS = ["90001","90210","91401","90802","92101","92020","92501","92262","93101","93301","93701","93901","94102","94601","95110","95202","95814","95401","95926","96001","95501","92801","94954","93534","95350","96150","77001","77479","75201","75070","78701","78205","76102","79901","79401","79101","78401","78501","76701","75701","79701","77701","79601","78040","77840","75961","76301","78596","79912","77550","33101","33186","32801","33602","32202","32301","33301","33401","33901","32501","32601","34236","32114","34102","34470","33801","34952","32962","32034","33040","32703","33510"];

async function main() {
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");
  console.log(`\n▶ LEXUS OEM CRAWL (CA/TX/FL) — ${ZIPS.length} zip anchors`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.lexus.com/dealers", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000);

  const byCode = new Map();
  for (let i = 0; i < ZIPS.length; i++) {
    try {
      const dealers = await page.evaluate(async (zip) => {
        const r = await fetch(`https://www.lexus.com/rest/lexus/dealers?experience=dealers&dealerSearchStrategy=expand&zip=${zip}&count=50`, { headers: { Accept: "application/json" } });
        if (!r.ok) return { _status: r.status };
        return (await r.json()).dealers || [];
      }, ZIPS[i]);
      if (dealers._status) { if (i < 3) console.log(`  ! zip ${ZIPS[i]} HTTP ${dealers._status}`); }
      else for (const d of dealers) if (d.id && !byCode.has(d.id)) byCode.set(d.id, d);
    } catch (e) { console.error(`  ! zip ${ZIPS[i]}: ${String(e.message).slice(0, 80)}`); }
    if ((i + 1) % 20 === 0 || i === ZIPS.length - 1) console.log(`  [${i + 1}/${ZIPS.length}] unique Lexus dealers: ${byCode.size}`);
    await sleep(700);
  }
  await browser.close();

  const existing = db.prepare("SELECT id, name, city, phone, latitude, longitude FROM dealerships WHERE oem='Lexus'").all();
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
  const near = (la, ln) => existing.find((e) => e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);

  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum', phone=COALESCE(phone,@phone), email=COALESCE(email,@email),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip), website=COALESCE(website,@web),
      latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
      source=CASE WHEN source LIKE '%oem:lexus%' THEN source ELSE source||'+oem:lexus' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,email,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,'Lexus',@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@email,@web,'oem:lexus',1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

  let confirmed = 0, inserted = 0;
  for (const d of byCode.values()) {
    const a = d.dealerAddress || {};
    const state = a.state;
    const lat = d.dealerLatitude != null ? +d.dealerLatitude : null, lng = d.dealerLongitude != null ? +d.dealerLongitude : null;
    const phone = d.dealerPhone || null;
    const web = d.dealerSiteUrl || null;
    const m = (lat != null && near(lat, lng)) || (phone && byPhone.get(digits(phone)));
    if (m) { upd.run({ id: m.id, code: d.id, phone, email: d.dealerEmail || null, street: a.address1 || null, zip: a.zipCodeFive || a.zipCode || null, web, lat, lng }); confirmed++; }
    else if (!ALLOW.has(state)) { /* border bleed — skip net-new outside MVP states */ }
    else {
      try { ins.run({ name: d.dealerName, street: a.address1 || null, city: a.city || null, state, zip: a.zipCodeFive || a.zipCode || null, territory: REGION[state] || "US-Other", lat, lng, phone, email: d.dealerEmail || null, web, code: d.id, dedup: `lexus|${d.id}` }); inserted++; }
      catch { /* dup */ }
    }
  }
  console.log(`\n  ✓ Lexus: ${byCode.size} pulled → ${confirmed} upgraded, ${inserted} net-new — all Platinum (dealer codes)`);
  console.log(`  Lexus CA/TX/FL manufacturer-confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem='Lexus' AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get().n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
