/*
 * KIA OEM CRAWL (CA/TX/FL) — Kia's dealer locator POSTs to
 * https://www.kia.com/us/services/en/dealers/search with JSON body
 * {type:"zip", zipCode, dealerCertifications:[], dealerServices:[]} → returns an
 * array (capped ~20/zip) of {code, name, location{street1,city,state,latitude,longitude,zipCode}, phones[], url}.
 * code = manufacturer dealer code (e.g. "CA333"). In-page fetch clears any bot-wall.
 * Zip-loop across CA/TX/FL anchors, dedup by code, filter to CA/TX/FL, match existing by geo→phone → Platinum.
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
// Dense zip anchors across CA/TX/FL — 20/zip cap means we need good spatial coverage.
const ZIPS = [
  // CA
  "90001","90210","90802","91401","91764","92101","92020","92501","92262","92801","93101","93301","93701","93901","94102","94601","94954","95110","95202","95814","95401","95926","96001","95501","95350","96150","92553","92345","93534","92243","95687","96097","94538","95376","93030","93534",
  // TX
  "77001","77479","77840","75201","75070","78701","78205","76102","79901","79401","79101","78401","78501","76701","75701","79701","77701","79601","78040","75961","76301","78596","79912","77550","78840","77901","76310","75503","78744","78414","77802","79764","75601","78223",
  // FL
  "33101","33186","32801","33602","32202","32301","33301","33401","33901","32501","32601","34236","32114","34102","34470","33801","34952","32962","32034","33040","32703","33510","33511","34741","32164","33176","34608","32955","32720","33025","33063","32771","34205"
].filter(z => /^\d{5}$/.test(z));

async function main() {
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");
  console.log(`\n▶ KIA OEM CRAWL (CA/TX/FL) — ${ZIPS.length} zip anchors, POST dealers/search`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.kia.com/us/en/find-a-dealer/result?zipCode=90210", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000);

  const byCode = new Map();
  for (let i = 0; i < ZIPS.length; i++) {
    try {
      const dealers = await page.evaluate(async (zip) => {
        const r = await fetch("https://www.kia.com/us/services/en/dealers/search", {
          method: "POST",
          headers: { "Content-Type": "application/json;charset=UTF-8", "Accept": "application/json, text/plain, */*", "custom-spinner": "true" },
          body: JSON.stringify({ type: "zip", zipCode: zip, dealerCertifications: [], dealerServices: [] })
        });
        if (!r.ok) return { _status: r.status };
        const j = await r.json();
        return Array.isArray(j) ? j : { _status: "not-array" };
      }, ZIPS[i]);
      if (dealers._status) { if (i < 3) console.log(`  ! zip ${ZIPS[i]} -> ${dealers._status}`); }
      else for (const d of dealers) if (d.code && !byCode.has(d.code)) byCode.set(d.code, d);
    } catch (e) { console.error(`  ! zip ${ZIPS[i]}: ${String(e.message).slice(0, 80)}`); }
    if ((i + 1) % 20 === 0 || i === ZIPS.length - 1) console.log(`  [${i + 1}/${ZIPS.length}] unique Kia dealers: ${byCode.size}`);
    await sleep(600);
  }
  await browser.close();

  const existing = db.prepare("SELECT id, name, city, phone, latitude, longitude FROM dealerships WHERE oem='Kia'").all();
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
  const near = (la, ln) => existing.find((e) => e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);
  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum', phone=COALESCE(phone,@phone),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip), website=COALESCE(website,@web),
      latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
      source=CASE WHEN source LIKE '%oem:kia%' THEN source ELSE source||'+oem:kia' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,'Kia',@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@web,'oem:kia',1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

  let confirmed = 0, inserted = 0;
  for (const d of byCode.values()) {
    const a = d.location || {};
    if (!ALLOW.has(a.state)) continue;
    const lat = a.latitude != null ? parseFloat(a.latitude) : null;
    const lng = a.longitude != null ? parseFloat(a.longitude) : null;
    const rawPhone = (d.phones || []).find((p) => p && p.number)?.number || null;
    const phone = fmtPhone(rawPhone);
    const web = d.url ? (/^https?:/i.test(d.url) ? d.url : `http://${d.url}`) : null;
    const m = (lat != null && near(lat, lng)) || (phone && byPhone.get(digits(phone)));
    if (m) { upd.run({ id: m.id, code: d.code, phone, street: (a.street1 || "").trim() || null, zip: a.zipCode || null, web, lat, lng }); confirmed++; }
    else { try { ins.run({ name: d.name, street: (a.street1 || "").trim() || null, city: a.city || null, state: a.state, zip: a.zipCode || null, territory: REGION[a.state] || "US-Other", lat, lng, phone, web, code: d.code, dedup: `kia|${d.code}` }); inserted++; } catch {} }
  }
  console.log(`\n  ✓ Kia: ${byCode.size} pulled → ${confirmed} upgraded, ${inserted} net-new — all Platinum (dealer codes)`);
  console.log(`  Kia CA/TX/FL manufacturer-confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem='Kia' AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get().n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
