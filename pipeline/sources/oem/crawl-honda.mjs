/*
 * HONDA OEM SPINE CRAWLER (CA/TX/FL MVP) — pulls every Honda franchise from Honda's
 * own locator API (which natively excludes service centers). Browser bypasses Akamai.
 * Honda's API is zip-based and returns no lat/lng, so we match existing rooftops by
 * PHONE (strong key) then name+city. brand_confirmed=1, dealer_code, source=oem:honda.
 */
import { chromium } from "playwright-core";
import Database from "better-sqlite3";

const ROOT = new URL("../../../", import.meta.url);
const DB = new URL("data/dealerships.sqlite", ROOT).pathname;
// Full Chromium (not headless-shell) + anti-automation flag — clears stricter Akamai (Honda etc.).
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALLOW = new Set(["CA", "TX", "FL"]);
const digits = (p) => (p || "").replace(/\D/g, "").slice(-10);

// Zip anchors spread across CA/TX/FL metros + regions; maxResults=60 + dealer-code dedup
// means heavy overlap is free — we just need every franchise within 60-nearest of one anchor.
const ZIPS = [
  // CA
  "90001","90210","91401","90802","92101","92020","92501","92262","93101","93301","93701","93901","94102","94601","95110","95202","95814","95401","95926","96001","95501","92801","94954","93534","95350","96150",
  // TX
  "77001","77479","75201","75070","78701","78205","76102","79901","79401","79101","78401","78501","76701","75701","79701","77701","79601","78040","77840","75961","76301","78596","79912","77550",
  // FL
  "33101","33186","32801","33602","32202","32301","33301","33401","33901","32501","32601","34236","32114","34102","34470","33801","34952","32962","32034","33040","32703","33510",
];

async function main() {
  const db = new Database(DB);
  const cols = new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name));
  if (!cols.has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");

  console.log(`\n▶ HONDA OEM CRAWL (CA/TX/FL) — ${ZIPS.length} zip anchors`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://automobiles.honda.com/tools/dealership-locator", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000);

  const byCode = new Map();
  for (let i = 0; i < ZIPS.length; i++) {
    try {
      const dealers = await page.evaluate(async (zip) => {
        const r = await fetch(`https://automobiles.honda.com/platform/api/v2/dealer?productDivisionCode=A&excludeServiceCenters=true&maxResults=60&zip=${zip}`, { headers: { Accept: "application/json" } });
        if (!r.ok) return { _status: r.status };
        return (await r.json()).Dealers || [];
      }, ZIPS[i]);
      if (dealers._status) { if (i < 3) console.log(`  ! zip ${ZIPS[i]} HTTP ${dealers._status}`); }
      else for (const d of dealers) if (d.DealerNumber && !byCode.has(d.DealerNumber)) byCode.set(d.DealerNumber, d);
    } catch (e) { console.error(`  ! zip ${ZIPS[i]}: ${String(e.message).slice(0, 80)}`); }
    if ((i + 1) % 20 === 0 || i === ZIPS.length - 1) console.log(`  [${i + 1}/${ZIPS.length}] unique Honda dealers: ${byCode.size}`);
    await sleep(700);
  }
  await browser.close();

  // Existing Honda rooftops → index by phone + name|city for matching (no lat/lng from Honda API).
  const existing = db.prepare("SELECT id, name, city, phone FROM dealerships WHERE oem='Honda'").all();
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
  const nameCity = (n, c) => (n || "").toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + (c || "").toLowerCase();
  const byNameCity = new Map(existing.map((e) => [nameCity(e.name, e.city), e]));

  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, phone=COALESCE(phone,@phone),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip),
      source=CASE WHEN source LIKE '%oem:honda%' THEN source ELSE source||'+oem:honda' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,phone,source,brand_confirmed,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,'Honda',@street,@city,@state,@zip,'US',@territory,@phone,'oem:honda',1,@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
  const REGION = { CA: "US-West", TX: "US-South", FL: "US-South" };

  let confirmed = 0, inserted = 0;
  for (const d of byCode.values()) {
    if (!ALLOW.has(d.State)) continue; // MVP scope
    const phone = d.Phone || null;
    const m = (phone && byPhone.get(digits(phone))) || byNameCity.get(nameCity(d.Name, d.City));
    if (m) { upd.run({ id: m.id, code: d.DealerNumber, phone, street: d.Address || null, zip: d.ZipCode || null }); confirmed++; }
    else {
      try { ins.run({ name: d.Name, street: d.Address || null, city: d.City || null, state: d.State, zip: d.ZipCode || null, territory: REGION[d.State] || "US-Other", phone, code: d.DealerNumber, dedup: `honda|${d.DealerNumber}` }); inserted++; }
      catch { /* dup */ }
    }
  }
  console.log(`\n  ✓ Honda crawl done: ${byCode.size} pulled → ${confirmed} matched/upgraded, ${inserted} net-new — all brand_confirmed (Platinum)`);
  console.log(`  Honda CA/TX/FL now manufacturer-confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem='Honda' AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get().n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
