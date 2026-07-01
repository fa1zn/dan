/*
 * JAGUAR + LAND ROVER OEM SPINE CRAWLER (CA/TX/FL MVP) — JLR share one retailer platform:
 * retailerlocator.jaguarlandrover.com/dealers?postCode=&brand=Jaguar|Land Rover. Returns
 * ciCode (OEM DEALER CODE, e.g. "05808" Jag / "R0428" LR), name, address{line1,town,county=state,
 * postCode}, latitude, longitude, filteredPhoneNumber/services[].phone, homePage.
 * We run BOTH brands (brand param swap). Match existing by geo (~400m) then phone → Platinum.
 * INSERT net-new CA/TX/FL only.  Run: node pipeline/sources/oem/crawl-jlr.mjs [Jaguar|LandRover|both]
 */
import { chromium } from "playwright-core";
import Database from "better-sqlite3";

const ROOT = new URL("../../../", import.meta.url);
const DB = new URL("data/dealerships.sqlite", ROOT).pathname;
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALLOW = new Set(["CA", "TX", "FL"]);
const digits = (p) => (p == null ? "" : String(p)).replace(/\D/g, "").slice(-10);
const asStr = (v) => (typeof v === "string" ? v : (v && typeof v === "object" && typeof v.number === "string" ? v.number : null));
const REGION = { CA: "US-West", TX: "US-South", FL: "US-South" };
const ZIPS = ["90210","90802","92101","92501","93101","93701","94102","95814","95350","92801","96001","95926","77001","75201","78701","76102","79901","78205","78401","77840","76701","79701","33101","33186","32801","33602","32202","33301","33401","34236","32601","33801","32114"];

const BRANDS = { Jaguar: { oem: "Jaguar", param: "Jaguar", src: "oem:jaguar", dedup: "jaguar" },
                 "Land Rover": { oem: "Land Rover", param: "Land Rover", src: "oem:landrover", dedup: "landrover" } };

async function crawlBrand(db, page, cfg) {
  const byCode = new Map();
  for (let i = 0; i < ZIPS.length; i++) {
    try {
      const dealers = await page.evaluate(async ([zip, brand]) => {
        const url = `https://retailerlocator.jaguarlandrover.com/dealers?postCode=${zip}&requestMarketLocale=en_us&brand=${encodeURIComponent(brand)}&filter=dealer&radius=200&unitOfMeasure=Miles&country=us&fetchOpeningTimes=false`;
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok) return { _status: r.status };
        return (await r.json()).dealers || [];
      }, [ZIPS[i], cfg.param]);
      if (dealers._status) { if (i < 3) console.log(`  ! ${cfg.oem} zip ${ZIPS[i]} HTTP ${dealers._status}`); }
      else for (const d of dealers) if (d.ciCode && d.dealer && !byCode.has(d.ciCode)) byCode.set(d.ciCode, d);
    } catch (e) { console.error(`  ! ${cfg.oem} zip ${ZIPS[i]}: ${String(e.message).slice(0, 70)}`); }
    if ((i + 1) % 10 === 0 || i === ZIPS.length - 1) console.log(`  [${cfg.oem} ${i + 1}/${ZIPS.length}] unique: ${byCode.size}`);
    await sleep(700);
  }

  const existing = db.prepare("SELECT id, name, city, phone, latitude, longitude FROM dealerships WHERE oem=?").all(cfg.oem);
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
  const near = (la, ln) => existing.find((e) => e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);

  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum', phone=COALESCE(phone,@phone), website=COALESCE(website,@web),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip),
      latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
      source=CASE WHEN source LIKE '%'||@src||'%' THEN source ELSE source||'+'||@src END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,@oem,@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@web,@src,1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

  let confirmed = 0, inserted = 0;
  for (const d of byCode.values()) {
    const a = d.address || {};
    const state = a.county;
    const lat = d.latitude != null ? +d.latitude : null, lng = d.longitude != null ? +d.longitude : null;
    const sales = (d.services || []).find((s) => s.type === "sales");
    const phone = asStr(d.filteredPhoneNumber) || asStr(sales?.phone) || asStr((d.services || [])[0]?.phone) || null;
    const web = d.homePage || null;
    const zip = (a.postCode || "").split("-")[0] || null;
    const m = (lat != null && near(lat, lng)) || (phone && byPhone.get(digits(phone)));
    if (m) { upd.run({ id: m.id, code: d.ciCode, phone, web, street: a.line1 || null, zip, lat, lng, src: cfg.src }); confirmed++; }
    else if (!ALLOW.has(state)) { /* border bleed */ }
    else {
      try { ins.run({ name: d.name, oem: cfg.oem, street: a.line1 || null, city: a.town || null, state, zip, territory: REGION[state] || "US-Other", lat, lng, phone, web, src: cfg.src, code: d.ciCode, dedup: `${cfg.dedup}|${d.ciCode}` }); inserted++; }
      catch { /* dup */ }
    }
  }
  console.log(`  ✓ ${cfg.oem}: ${byCode.size} pulled → ${confirmed} upgraded, ${inserted} net-new (Platinum)`);
  console.log(`    ${cfg.oem} CA/TX/FL confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem=? AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get(cfg.oem).n}`);
}

async function main() {
  const which = process.argv[2] || "both";
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");
  console.log(`\n▶ JLR OEM CRAWL (CA/TX/FL) — ${ZIPS.length} zip anchors — target: ${which}`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.jaguar.com/en-us/jdx/retailer-locator/index.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000);
  const targets = which === "both" ? Object.values(BRANDS) : [BRANDS[which === "LandRover" ? "Land Rover" : "Jaguar"]];
  for (const cfg of targets) await crawlBrand(db, page, cfg);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
