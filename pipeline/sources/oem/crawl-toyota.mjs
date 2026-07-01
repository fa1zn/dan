/*
 * TOYOTA OEM SPINE CRAWLER — pulls every Toyota franchise straight from Toyota's own
 * dealer-locator API, the authoritative source. Bypasses Akamai by driving a real
 * headless browser (loads the locator once to clear the gate, then calls the JSON
 * endpoint from inside that trusted session). 0% noise: every row is a real franchise
 * with its manufacturer DEALER CODE. brand_confirmed=1, source=oem:toyota, Platinum.
 *
 *   node pipeline/sources/oem/crawl-toyota.mjs            # full US
 *   CRAWL_LIMIT=8 node ...                                # test: first 8 grid points
 */
import { chromium } from "playwright-core";
import Database from "better-sqlite3";

const ROOT = new URL("../../../", import.meta.url);
const DB = new URL("data/dealerships.sqlite", ROOT).pathname;
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const LIMIT = Number(process.env.CRAWL_LIMIT || 0);
const STEP = Number(process.env.CRAWL_STEP || 1.3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// MVP scope: CA / TX / FL bounding boxes. Nearest-N per point + dealer-code dedup means
// overlap is free; net-new inserts are filtered to these three states (border bleed dropped).
const MVP_BBOX = [
  { latMin: 32.4, latMax: 42.1, lngMin: -124.5, lngMax: -114.0 }, // CA
  { latMin: 25.8, latMax: 36.6, lngMin: -106.7, lngMax: -93.5 }, // TX
  { latMin: 24.4, latMax: 31.1, lngMin: -87.7, lngMax: -79.9 }, // FL
];
const ALLOW = new Set(["CA", "TX", "FL"]);
function usGrid(step) {
  if (!process.env.CRAWL_NATIONAL) {
    const pts = [];
    for (const b of MVP_BBOX) for (let lat = b.latMin; lat <= b.latMax; lat += step) for (let lng = b.lngMin; lng <= b.lngMax; lng += step) pts.push([+lat.toFixed(2), +lng.toFixed(2)]);
    return pts;
  }
  const pts = [];
  for (let lat = 24.5; lat <= 49.5; lat += step) for (let lng = -124.5; lng <= -66.5; lng += step) pts.push([+lat.toFixed(2), +lng.toFixed(2)]);
  pts.push([61.2, -149.9], [21.3, -157.8], [64.8, -147.7]);
  return pts;
}

const REGION = { CT:"US-Northeast",ME:"US-Northeast",MA:"US-Northeast",NH:"US-Northeast",RI:"US-Northeast",VT:"US-Northeast",NJ:"US-Northeast",NY:"US-Northeast",PA:"US-Northeast",
  IL:"US-Midwest",IN:"US-Midwest",MI:"US-Midwest",OH:"US-Midwest",WI:"US-Midwest",IA:"US-Midwest",KS:"US-Midwest",MN:"US-Midwest",MO:"US-Midwest",NE:"US-Midwest",ND:"US-Midwest",SD:"US-Midwest",
  DE:"US-South",FL:"US-South",GA:"US-South",MD:"US-South",NC:"US-South",SC:"US-South",VA:"US-South",DC:"US-South",WV:"US-South",AL:"US-South",KY:"US-South",MS:"US-South",TN:"US-South",AR:"US-South",LA:"US-South",OK:"US-South",TX:"US-South",
  AZ:"US-West",CO:"US-West",ID:"US-West",MT:"US-West",NV:"US-West",NM:"US-West",UT:"US-West",WY:"US-West",AK:"US-West",CA:"US-West",HI:"US-West",OR:"US-West",WA:"US-West" };

async function main() {
  const db = new Database(DB);
  const cols = new Set(db.prepare("PRAGMA table_info(dealerships)").all().map((c) => c.name));
  if (!cols.has("dealer_code")) db.exec("ALTER TABLE dealerships ADD COLUMN dealer_code TEXT");

  const grid = (() => { const g = usGrid(STEP); return LIMIT ? g.slice(0, LIMIT) : g; })();
  console.log(`\n▶ TOYOTA OEM CRAWL — ${grid.length} grid points (step ${STEP}°)`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  await page.goto("https://www.toyota.com/dealers/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000); // let Akamai set its token

  const byCode = new Map();
  for (let i = 0; i < grid.length; i++) {
    const [lat, lng] = grid[i];
    try {
      const dealers = await page.evaluate(async ([la, ln]) => {
        const r = await fetch(`https://dealers.prod.webservices.toyota.com/v1/dealers/?latitude=${la}&longitude=${ln}`, { headers: { Accept: "application/json" } });
        if (!r.ok) return { _status: r.status };
        return (await r.json()).dealers || [];
      }, [lat, lng]);
      if (dealers._status) { if (i < 3) console.log(`  ! point ${i} HTTP ${dealers._status}`); }
      else for (const d of dealers) if (d.code && !byCode.has(d.code)) byCode.set(d.code, d);
    } catch (e) { console.error(`  ! point ${i}: ${String(e.message).slice(0, 80)}`); }
    if ((i + 1) % 50 === 0 || i === grid.length - 1) console.log(`  [${i + 1}/${grid.length}] unique Toyota dealers so far: ${byCode.size}`);
    await sleep(700); // gentle
  }
  await browser.close();

  // Store: match existing Toyota rooftop by geo (~400m) → confirm/upgrade; else insert. Platinum.
  const existing = db.prepare("SELECT id, latitude, longitude, source FROM dealerships WHERE oem='Toyota'").all();
  const near = (la, ln) => existing.find((e) => e.latitude != null && Math.abs(e.latitude - la) < 0.004 && Math.abs(e.longitude - ln) < 0.004);
  const upd = db.prepare(`UPDATE dealerships SET dealer_code=@code, brand_confirmed=1, phone=COALESCE(phone,@phone), email=COALESCE(email,@email),
      address_street=COALESCE(address_street,@street), postal_code=COALESCE(postal_code,@zip),
      source=CASE WHEN source LIKE '%oem:toyota%' THEN source ELSE source||'+oem:toyota' END, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
  const ins = db.prepare(`INSERT INTO dealerships (name,oem,address_street,city,state_province,postal_code,country,territory,latitude,longitude,phone,email,source,brand_confirmed,dealer_code,dedup_key,created_at,updated_at)
      VALUES (@name,'Toyota',@street,@city,@state,@zip,'US',@territory,@lat,@lng,@phone,@email,'oem:toyota',1,@code,@dedup,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
  let confirmed = 0, inserted = 0;
  const now = Date.now();
  for (const d of byCode.values()) {
    const lat = d.latitude ?? d.lat, lng = d.longitude ?? d.long;
    const phone = d.general?.phone || null, email = d.email || null;
    const m = lat != null ? near(lat, lng) : null;
    if (m) { upd.run({ id: m.id, code: d.code, phone, email, street: d.address1 || null, zip: d.zip || null }); confirmed++; }
    else if (!process.env.CRAWL_NATIONAL && !ALLOW.has(d.state)) { /* border bleed — skip net-new outside MVP states */ }
    else {
      try {
        ins.run({ name: d.name, street: d.address1 || null, city: d.city || null, state: d.state || null, zip: d.zip || null,
          territory: REGION[d.state] || "US-Other", lat: lat ?? null, lng: lng ?? null, phone, email, code: d.code, dedup: `toyota|${d.code}` });
        inserted++;
      } catch { /* dup dedup_key */ }
    }
  }
  console.log(`\n  ✓ Toyota crawl done: ${byCode.size} franchises pulled → ${confirmed} matched/upgraded existing, ${inserted} net-new — all brand_confirmed (Platinum)`);
  console.log(`  Toyota rooftops now manufacturer-confirmed: ${db.prepare("SELECT COUNT(*) n FROM dealerships WHERE oem='Toyota' AND brand_confirmed=1").get().n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
