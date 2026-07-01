/*
 * MERCEDES-BENZ OEM CRAWL (CA/TX/FL) — mbusa.com dealer search API is clean & public:
 *   https://nafta-service.mbusa.com/api/dlrsrv/v1/us/search?zip={zip}&start=0&count=100&filter=mbdealer
 *   → { results:[ {id, name, address:[{line1,city,state,zip,location:{lat,lng}}], contact:[{type:'phone',value}], url} ] }
 *   id = real MB dealer code. Zip-loop, dedupe by id. In-page fetch (referer mbusa.com/en/dealers) clears gate.
 * Filter CA/TX/FL, match existing by geo then phone → Platinum.
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
const SEED_ZIPS = ["90001","90210","91401","90802","92101","92020","92501","92262","93101","93301","93701","93901","94102","94601","95110","95202","95814","95401","95926","96001","95501","92801","94954","93534","95350","96150","77001","77479","75201","75070","78701","78205","76102","79901","79401","79101","78401","78501","76701","75701","79701","77701","79601","78040","77840","75961","76301","78596","79912","77550","33101","33186","32801","33602","32202","32301","33301","33401","33901","32501","32601","34236","32114","34470","33801","34952","32962","32034","33040","32703","33510"];

async function main() {
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");
  const dbZips = db.prepare("SELECT DISTINCT substr(postal_code,1,5) z FROM dealerships WHERE oem='Mercedes-Benz' AND state_province IN ('CA','TX','FL') AND postal_code IS NOT NULL").all().map((r) => r.z).filter((z) => /^\d{5}$/.test(z));
  const ZIPS = [...new Set([...SEED_ZIPS, ...dbZips])];

  console.log(`\n▶ MERCEDES-BENZ OEM CRAWL (CA/TX/FL) — ${ZIPS.length} zip anchors`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.mbusa.com/en/dealers", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(2500);

  const byCode = new Map();
  for (let i = 0; i < ZIPS.length; i++) {
    try {
      const dealers = await page.evaluate(async (zip) => {
        const r = await fetch(`https://nafta-service.mbusa.com/api/dlrsrv/v1/us/search?zip=${zip}&start=0&count=100&filter=mbdealer`, { headers: { Accept: "application/json" } });
        if (!r.ok) return { _status: r.status };
        return (await r.json()).results || [];
      }, ZIPS[i]);
      if (dealers._status) { if (i < 3) console.log(`  ! zip ${ZIPS[i]} HTTP ${dealers._status}`); }
      else for (const d of dealers) if (d.id && !byCode.has(d.id)) byCode.set(d.id, d);
    } catch (e) { console.error(`  ! zip ${ZIPS[i]}: ${String(e.message).slice(0, 80)}`); }
    if ((i + 1) % 20 === 0 || i === ZIPS.length - 1) console.log(`  [${i + 1}/${ZIPS.length}] unique MB dealers: ${byCode.size}`);
    await sleep(700);
  }
  await browser.close();

  const existing = db.prepare("SELECT id, name, city, phone, latitude, longitude FROM dealerships WHERE oem='Mercedes-Benz'").all();
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
  const near = (la, ln) => existing.find((e) => e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);
  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum', phone=COALESCE(phone,@phone),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip), website=COALESCE(website,@web),
      latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
      source=CASE WHEN source LIKE '%oem:mercedes%' THEN source ELSE source||'+oem:mercedes' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,'Mercedes-Benz',@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@web,'oem:mercedes',1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

  let confirmed = 0, inserted = 0;
  for (const d of byCode.values()) {
    const a = (d.address || [])[0] || {};
    if (!ALLOW.has(a.state)) continue;
    const lat = a.location?.lat ? parseFloat(a.location.lat) : null;
    const lng = a.location?.lng ? parseFloat(a.location.lng) : null;
    const phoneRaw = (d.contact || []).find((c) => c.type === "phone")?.value || null;
    const phone = fmtPhone(phoneRaw);
    const web = d.url || null;
    const m = (lat != null && near(lat, lng)) || (phone && byPhone.get(digits(phone)));
    if (m) { upd.run({ id: m.id, code: d.id, phone, street: a.line1 || null, zip: (a.zip||"").slice(0,5) || null, web, lat, lng }); confirmed++; }
    else { try { ins.run({ name: d.name, street: a.line1 || null, city: a.city || null, state: a.state, zip: (a.zip||"").slice(0,5) || null, territory: REGION[a.state] || "US-Other", lat, lng, phone, web, code: d.id, dedup: `mercedes|${d.id}` }); inserted++; } catch {} }
  }
  console.log(`\n  ✓ Mercedes-Benz: ${byCode.size} pulled → ${confirmed} upgraded, ${inserted} net-new — all Platinum (dealer codes)`);
  console.log(`  MB CA/TX/FL manufacturer-confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem='Mercedes-Benz' AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get().n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
