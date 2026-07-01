/*
 * FRANCHISE GATE — reversible flagging of the rooftop table.
 *
 * The Google-Places geo-grid discovery over-captures (~34.7K rows) vs. the true
 * US+CA franchised new-car count (~16.7K NADA). This step FLAGS rows so downstream
 * consumers can filter without losing anything. It NEVER deletes or replaces rows.
 *
 * Two independent signals, written to two lazily-added columns:
 *
 *   noise = 1
 *     name/type matches a used/service/parts/collision/rental/etc. pattern — i.e.
 *     the row is almost certainly NOT an authorized new-car franchise rooftop.
 *
 *   franchise_confirmed = 1
 *     the row matches a brand's OEM dealer-locator set: same OEM AND either within
 *     ~1km haversine of a located dealer, OR a normalized-address match. This is a
 *     positive, manufacturer-sourced confirmation of franchise status.
 *
 * OEM confirmation only runs for brands with a verified live locator
 * (locators-live.ts). Rows of other brands keep franchise_confirmed unchanged
 * (default 0) — absence of confirmation is NOT proof of non-franchise, so callers
 * should treat 0 as "unconfirmed", not "reject".
 *
 * Usage (sample-scoped, per the safety rules — never national):
 *   tsx pipeline/run.ts gate --state AZ
 *   tsx pipeline/run.ts gate --brand Ford        (noise-only for unsupported brands)
 *   tsx pipeline/run.ts gate --state AZ --oem Subaru
 */
import { getSqlite } from "../../lib/db";
import { LIVE_LOCATORS } from "../sources/oem/locators-live";

/** Names/types that denote a non-franchise facility (used lot, service bay, etc.). */
const NOISE_RE =
  /(service|parts|body|collision|used|rental|powersports|motorcycle|marine|\brv\b|wholesale|quick lane|oil change|tire)/i;

interface GateRow {
  id: number;
  name: string;
  oem: string | null;
  address_street: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
}

// ── geo + address helpers ──────────────────────────────────────────────────────
function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Same normalization the entity-resolver uses, so address matches are comparable. */
function normAddr(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(
      /\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|highway|hwy|freeway|fwy|suite|ste|unit|north|south|east|west|n|s|e|w)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

// ── lazy column migration (PRAGMA-guarded ALTER, matches the repo pattern) ──────
function ensureColumns(): void {
  const db = getSqlite();
  const cols = new Set(
    (db.prepare("PRAGMA table_info(dealerships)").all() as { name: string }[]).map((c) => c.name)
  );
  if (!cols.has("franchise_confirmed"))
    db.exec("ALTER TABLE dealerships ADD COLUMN franchise_confirmed INTEGER NOT NULL DEFAULT 0");
  if (!cols.has("noise")) db.exec("ALTER TABLE dealerships ADD COLUMN noise INTEGER NOT NULL DEFAULT 0");
}

interface GateArgs {
  state?: string;
  brand?: string; // canonical OEM to scope to
  limit?: number;
}

function parseArgs(argv: string[]): GateArgs {
  const out: GateArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "--state" || a === "-s") && argv[i + 1]) out.state = argv[++i].toUpperCase();
    else if ((a === "--brand" || a === "--oem" || a === "-b") && argv[i + 1]) out.brand = argv[++i];
    else if ((a === "--limit" || a === "-n") && argv[i + 1]) out.limit = Number(argv[++i]);
  }
  return out;
}

export async function runFranchiseGate(argv: string[] = process.argv.slice(3)): Promise<void> {
  const args = parseArgs(argv);
  ensureColumns();
  const db = getSqlite();

  // Scope the sample. SAFETY: never gate the whole table in one shot — require a
  // state or brand scope so we operate on a bounded sample per the run's rules.
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (args.state) {
    where.push("state_province = @state");
    params.state = args.state;
  }
  if (args.brand) {
    where.push("oem = @brand");
    params.brand = args.brand;
  }
  if (!args.state && !args.brand) {
    console.error(
      "  refusing to gate the entire table. Scope it: gate --state AZ  (or)  gate --brand Ford"
    );
    process.exit(1);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT id, name, oem, address_street, city, state_province, postal_code, latitude, longitude, source
       FROM dealerships ${clause} ORDER BY id ${args.limit ? "LIMIT " + Number(args.limit) : ""}`
    )
    .all(params) as GateRow[];

  console.log(
    `\n▶ FRANCHISE GATE — scope: ${args.state ?? "*"}/${args.brand ?? "*"} · ${rows.length} rooftops`
  );

  // 1) NOISE flag (name/type heuristic; cheap, no network).
  const setNoise = db.prepare("UPDATE dealerships SET noise=@n, updated_at=CURRENT_TIMESTAMP WHERE id=@id");
  let noiseCount = 0;
  const noiseExamples: string[] = [];
  const tx1 = db.transaction((rs: GateRow[]) => {
    for (const r of rs) {
      const hit = NOISE_RE.test(r.name) ? 1 : 0;
      setNoise.run({ id: r.id, n: hit });
      if (hit) {
        noiseCount++;
        if (noiseExamples.length < 5) noiseExamples.push(`${r.name} [${r.oem ?? "?"}, ${r.city ?? "?"}]`);
      }
    }
  });
  tx1(rows);

  // 2) FRANCHISE confirmation against verified OEM locators.
  // Gather the ZIPs present in the sample per supported OEM, fetch each brand's
  // located dealer set once per ZIP (cached in http layer), then match rooftops.
  const supported = new Set(Object.keys(LIVE_LOCATORS));
  const byOem = new Map<string, GateRow[]>();
  for (const r of rows) {
    if (r.oem && supported.has(r.oem)) {
      (byOem.get(r.oem) ?? byOem.set(r.oem, []).get(r.oem)!).push(r);
    }
  }

  const setConfirmed = db.prepare(
    "UPDATE dealerships SET franchise_confirmed=1, updated_at=CURRENT_TIMESTAMP WHERE id=@id"
  );
  let confirmedCount = 0;
  const confirmedExamples: string[] = [];
  const skippedOems = new Set<string>();

  for (const [oem, oemRows] of byOem) {
    const fetchByZip = LIVE_LOCATORS[oem];
    // ZIPs to query: the 3-digit-ish set of the sample's postal codes (5-digit).
    const zips = Array.from(
      new Set(
        oemRows
          .map((r) => (r.postal_code ?? "").replace(/\D/g, "").slice(0, 5))
          .filter((z) => z.length === 5)
      )
    );
    if (zips.length === 0) {
      skippedOems.add(`${oem}(no-zips)`);
      continue;
    }

    // Build the located-dealer set (deduped by dealerCode) for this OEM.
    const located: { lat?: number; lng?: number; addr: string }[] = [];
    const seenCodes = new Set<string>();
    let anyOk = false;
    for (const zip of zips) {
      let dealers;
      try {
        dealers = await fetchByZip(zip);
      } catch {
        continue;
      }
      if (dealers.length) anyOk = true;
      for (const d of dealers) {
        const key = d.dealerCode ?? `${d.name}|${d.zip}`;
        if (seenCodes.has(key)) continue;
        seenCodes.add(key);
        located.push({ lat: d.lat, lng: d.lng, addr: normAddr(d.street) });
      }
    }
    if (!anyOk) {
      skippedOems.add(`${oem}(locator-blocked)`);
      continue;
    }

    // Match each rooftop: same OEM AND (≤1km OR normalized-address match).
    const tx2 = db.transaction((rs: GateRow[]) => {
      for (const r of rs) {
        const rAddr = normAddr(r.address_street);
        const match = located.some((d) => {
          const geoHit =
            r.latitude != null &&
            r.longitude != null &&
            d.lat != null &&
            d.lng != null &&
            kmBetween(r.latitude, r.longitude, d.lat, d.lng) <= 1.0;
          const addrHit = rAddr.length > 4 && d.addr.length > 4 && rAddr === d.addr;
          return geoHit || addrHit;
        });
        if (match) {
          setConfirmed.run({ id: r.id });
          confirmedCount++;
          if (confirmedExamples.length < 5)
            confirmedExamples.push(`${r.name} [${oem}, ${r.city ?? "?"} ${r.state_province ?? ""}]`);
        }
      }
    });
    tx2(oemRows);
    console.log(`  [${oem}] ${zips.length} zips → ${located.length} located dealers · matched ${confirmedCount}`);
  }

  // Brands present in the sample with no live locator (documented as blocked/absent).
  const unsupported = Array.from(new Set(rows.map((r) => r.oem).filter((o): o is string => !!o && !supported.has(o))));

  console.log(`\n  ── franchise-gate summary ──`);
  console.log(`  rooftops gated:        ${rows.length}`);
  console.log(`  noise flagged:         ${noiseCount}`);
  console.log(`  franchise_confirmed:   ${confirmedCount}`);
  if (noiseExamples.length) console.log(`  noise examples:        ${noiseExamples.join(" · ")}`);
  if (confirmedExamples.length) console.log(`  confirmed examples:    ${confirmedExamples.join(" · ")}`);
  if (skippedOems.size) console.log(`  locator skipped:       ${Array.from(skippedOems).join(", ")}`);
  if (unsupported.length)
    console.log(`  no live locator (unconfirmed, kept): ${unsupported.slice(0, 20).join(", ")}`);
}
