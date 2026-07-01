/*
 * VOLKSWAGEN OEM CRAWL (CA/TX/FL) — VW's BFF returns ALL US dealers in a SINGLE call
 * (wildcard name search), so no zip grid needed. id = dealer code, coordinates=[lat,lng],
 * contact.phoneNumber/website. Filter to CA/TX/FL, match existing by geo/phone → Platinum.
 */
import { chromium } from "playwright-core";
import Database from "better-sqlite3";

const ROOT = new URL("../../../", import.meta.url);
const DB = new URL("data/dealerships.sqlite", ROOT).pathname;
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const ALLOW = new Set(["CA", "TX", "FL"]);
const digits = (p) => (p || "").replace(/\D/g, "").slice(-10);
const fmtPhone = (p) => { const d = digits(p); return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : (p || null); };
const REGION = { CA: "US-West", TX: "US-South", FL: "US-South" };

async function main() {
  const db = new Database(DB);
  if (!new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name)).has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");

  console.log(`\n▶ VOLKSWAGEN OEM CRAWL (CA/TX/FL) — single BFF call`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.vw.com/en/dealer-search.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));

  const dealers = await page.evaluate(async () => {
    const sce = JSON.stringify({ endpoint: { type: "publish", country: "us", language: "en", content: "onehub_pkw", envName: "prod", testScenarioId: null }, signature: "VehBWLTr2hxx8TJ85NJrpgRXoPfAyNcz2K8KuyXQTNI=" });
    const query = JSON.stringify({ type: "DEALER", language: "en-US", countryCode: "US", dealerServiceFilter: [], contentDealerServiceFilter: [], usePrimaryTenant: true, name: " " });
    const u = `https://v3-81-9.ds-us.dcc.feature-app.io/bff-search/dealers?serviceConfigEndpoint=${encodeURIComponent(sce)}&lufthansaApiKey=h0CQWvPYSBvp5KYXUpRU4FpZrnl0tZx1&query=${encodeURIComponent(query)}`;
    const r = await fetch(u, { headers: { Accept: "application/json" } });
    if (!r.ok) return { _status: r.status };
    return (await r.json()).dealers || [];
  });
  await browser.close();
  if (dealers._status) { console.log(`  ! BFF HTTP ${dealers._status}`); return; }
  console.log(`  pulled ${dealers.length} US VW dealers`);

  const existing = db.prepare("SELECT id, name, city, phone, latitude, longitude FROM dealerships WHERE oem='Volkswagen'").all();
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [digits(e.phone), e]));
  const near = (la, ln) => existing.find((e) => e.latitude != null && la != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);
  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, trust_tier='platinum', phone=COALESCE(phone,@phone),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip), website=COALESCE(website,@web),
      latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng),
      source=CASE WHEN source LIKE '%oem:volkswagen%' THEN source ELSE source||'+oem:volkswagen' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,website,source,brand_confirmed,trust_tier,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,'Volkswagen',@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@web,'oem:volkswagen',1,'platinum',@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);

  let confirmed = 0, inserted = 0;
  for (const d of dealers) {
    const a = d.address || {};
    if (!ALLOW.has(a.province)) continue;
    const lat = d.coordinates?.[0] ?? null, lng = d.coordinates?.[1] ?? null;
    const phone = fmtPhone(d.contact?.phoneNumber);
    const web = d.contact?.website || null;
    const m = (lat != null && near(lat, lng)) || (phone && byPhone.get(digits(phone)));
    if (m) { upd.run({ id: m.id, code: d.id, phone, street: a.street || null, zip: a.postalCode || null, web, lat, lng }); confirmed++; }
    else { try { ins.run({ name: d.name, street: a.street || null, city: a.city || null, state: a.province, zip: a.postalCode || null, territory: REGION[a.province] || "US-Other", lat, lng, phone, web, code: d.id, dedup: `volkswagen|${d.id}` }); inserted++; } catch {} }
  }
  console.log(`\n  ✓ VW: ${confirmed} upgraded, ${inserted} net-new — all Platinum (dealer codes)`);
  console.log(`  VW CA/TX/FL manufacturer-confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem='Volkswagen' AND state_province IN ('CA','TX','FL') AND brand_confirmed=1").get().n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
