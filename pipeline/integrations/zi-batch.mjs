/*
 * ZoomInfo bulk enrichment for Dan — search → enrich → store, over the whole book.
 * Drives ZoomInfo's MCP from a standalone script using the client-credentials OAuth
 * (client id/secret in .env → self-refreshing token, so it survives a multi-hour run).
 *
 * Credit-safe by design:
 *   - DRY RUN unless ZI_APPLY=1 (dry run makes NO enrich calls, spends no credits).
 *   - Idempotent: skips dealers already carrying a ZoomInfo contact (resumable).
 *   - Capped (ZI_MAX), best accounts first, ZI_DM decision-makers per dealer.
 *   - Rate-limited (ZI_RATE_MS between dealers) + 429 backoff.
 *
 * Usage:
 *   node pipeline/integrations/zi-batch.mjs            # dry run (plan only)
 *   ZI_APPLY=1 ZI_MAX=3 node ...                       # real, 3 dealers (test)
 *   ZI_APPLY=1 node ...                                # real, full book
 */
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ROOT = new URL("../../", import.meta.url);
const env = readFileSync(new URL(".env", ROOT), "utf8");
const g = (k) => env.split("\n").find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim() ?? "";
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const APPLY = ["1", "true"].includes((process.env.ZI_APPLY ?? "").toLowerCase());
const REGIONS = (process.env.ZI_REGIONS ?? "CA,TX,FL").split(",").map((s) => s.trim().toUpperCase());
const MAX = num(process.env.ZI_MAX, 0); // 0 = all
const DM = num(process.env.ZI_DM, 6); // decision-makers per dealer
const RATE_MS = num(process.env.ZI_RATE_MS, 2600); // ~23/min
const STATE_NAME = { CA: "California", TX: "Texas", FL: "Florida" };

const CLIENT_ID = g("ZOOMINFO_CLIENT_ID");
const CLIENT_SECRET = g("ZOOMINFO_CLIENT_SECRET");
const SCOPE = "api:data:mcp zi_mcp api:data:contact api:data:company";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Title priority — who a rep actually wants, in order.
const TITLE_RANK = [
  "general manager", "dealer principal", "owner", "president", "managing partner",
  "general sales manager", "director of sales", "internet sales", "bdc", "sales manager",
  "marketing", "service manager", "fixed operations",
];
const rankTitle = (t) => {
  const s = (t ?? "").toLowerCase();
  const i = TITLE_RANK.findIndex((k) => s.includes(k));
  return i === -1 ? TITLE_RANK.length : i;
};

/* ---- self-refreshing client-credentials token ---- */
let _tok = null, _exp = 0;
async function token() {
  if (_tok && Date.now() < _exp - 60_000) return _tok;
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const r = await fetch("https://okta-login.zoominfo.com/oauth2/default/v1/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("token mint failed: " + JSON.stringify(j));
  _tok = j.access_token;
  _exp = Date.now() + (j.expires_in ?? 3600) * 1000;
  return _tok;
}

async function connect() {
  const transport = new StreamableHTTPClientTransport(new URL("https://mcp.zoominfo.com/mcp"), {
    requestInit: { headers: { Authorization: `Bearer ${await token()}` } },
  });
  const client = new Client({ name: "dan-zoominfo-batch", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

const parse = (res) => {
  try {
    let v = JSON.parse(res.content?.[0]?.text ?? "{}");
    if (typeof v === "string") v = JSON.parse(v); // ZoomInfo MCP double-encodes the payload
    return v;
  } catch { return {}; }
};

async function callWithRetry(client, name, args, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      return await client.callTool({ name, arguments: args });
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (/429|rate|too many/i.test(msg) && i < tries - 1) { await sleep(4000 * (i + 1)); continue; }
      if (i < tries - 1) { await sleep(1500); continue; }
      throw e;
    }
  }
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("ZOOMINFO_CLIENT_ID / ZOOMINFO_CLIENT_SECRET not in .env");
  const db = new Database(new URL("data/dealerships.sqlite", ROOT).pathname);
  const ph = REGIONS.map(() => "?").join(",");
  // Best accounts first; skip ones already ZoomInfo-enriched (idempotent / resumable).
  let rows = db
    .prepare(
      `SELECT id, name, city, state_province, oem, contacts
       FROM dealerships
       WHERE state_province IN (${ph})
         AND (contacts IS NULL OR contacts NOT LIKE '%zoominfo%')
         AND oem NOT IN ('Tesla','Rivian','Lucid') AND name NOT LIKE '%Tesla%'
       ORDER BY (tier='A') DESC, COALESCE(confirmation_count,0) DESC, (phone IS NOT NULL) DESC, name`
    )
    .all(...REGIONS);
  if (MAX > 0) rows = rows.slice(0, MAX);

  const done = db.prepare(`SELECT COUNT(*) n FROM dealerships WHERE state_province IN (${ph}) AND contacts LIKE '%zoominfo%'`).get(...REGIONS).n;
  console.log(`\n▶ ZOOMINFO BULK ENRICH (${APPLY ? "APPLY — spending credits" : "DRY RUN — no credits"})`);
  console.log(`  regions: ${REGIONS.join("/")} · already enriched: ${done} · to process: ${rows.length} · ${DM} decision-makers/dealer`);
  console.log(`  est. enrich credits this run: ~${(rows.length * DM).toLocaleString()} (best case)`);

  if (!APPLY) {
    console.log(`\n  DRY RUN — set ZI_APPLY=1 to enrich for real. Sample of what would be processed:`);
    rows.slice(0, 8).forEach((r) => console.log(`    • ${r.name} — ${r.city ?? "?"}, ${r.state_province}`));
    return;
  }

  const client = await connect();
  const update = db.prepare("UPDATE dealerships SET contacts=@c, updated_at=CURRENT_TIMESTAMP WHERE id=@id");
  let dealersEnriched = 0, contactsAdded = 0, noMatch = 0, errors = 0;
  const t0 = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      // 1) find decision-makers at this dealer
      const sres = parse(await callWithRetry(client, "search_contacts", {
        companyName: r.name,
        state: STATE_NAME[r.state_province] ?? undefined,
        managementLevel: "C Level Exec,VP Level Exec,Director,Manager",
        requiredFields: "phone",
        pageSize: Math.max(DM + 2, 8),
        sort: "-contactAccuracyScore",
        userIntent: `Find decision-makers at ${r.name}, a car dealership in ${r.city ?? r.state_province}, for a dealership sales call list.`,
      }));
      const found = (sres.data ?? [])
        .map((d) => ({ id: d.id, ...d.attributes }))
        // keep only contacts whose company name reasonably matches the dealer (avoid generic mis-hits)
        .filter((d) => {
          const a = (d.company?.name ?? "").toLowerCase(), b = r.name.toLowerCase();
          return a.includes(b.split(" ")[0]) || b.includes((a.split(" ")[0] ?? "x"));
        })
        .sort((a, b) => rankTitle(a.jobTitle) - rankTitle(b.jobTitle) || (b.contactAccuracyScore ?? 0) - (a.contactAccuracyScore ?? 0))
        .slice(0, DM);

      if (!found.length) { noMatch++; }
      else {
        // 2) reveal verified dial + email
        const eres = parse(await callWithRetry(client, "enrich_contacts", {
          contacts: found.map((f) => ({ personId: String(f.id) })),
          requiredFields: ["firstName", "lastName", "jobTitle", "email", "phone", "mobilePhone", "directPhoneDoNotCall", "mobilePhoneDoNotCall", "contactAccuracyScore"],
          userIntent: `Reveal verified direct dials and emails for decision-makers at ${r.name} for the rep's call list.`,
        }));
        const people = [];
        for (const k of Object.keys(eres)) {
          const d = eres[k]?.data;
          if (!d || d.matchStatus === "COMPANY_ONLY_MATCH") continue;
          const name = [d.firstName, d.lastName].filter(Boolean).join(" ");
          if (!name) continue;
          people.push({
            name, title: d.jobTitle || d.title || undefined,
            email: d.email || undefined,
            phone: d.phone || undefined,
            mobile: d.mobilePhone || undefined,
            phoneDnc: d.directPhoneDoNotCall || false,
            mobileDnc: d.mobilePhoneDoNotCall || false,
            accuracy: Number(d.contactAccuracyScore) || undefined,
            source: "zoominfo",
          });
        }
        if (people.length) {
          let existing = [];
          try { existing = JSON.parse(r.contacts ?? "[]"); } catch {}
          const merged = existing.filter((c) => c.source !== "zoominfo").concat(people);
          update.run({ id: r.id, c: JSON.stringify(merged) });
          dealersEnriched++; contactsAdded += people.length;
        } else { noMatch++; }
      }
    } catch (e) {
      errors++;
      console.error(`  ! ${r.name}: ${String(e?.message ?? e).slice(0, 120)}`);
    }
    if ((i + 1) % 25 === 0 || i === rows.length - 1) {
      const rate = ((i + 1) / ((Date.now() - t0) / 60000)).toFixed(0);
      console.log(`  [${i + 1}/${rows.length}] enriched ${dealersEnriched} dealers · ${contactsAdded} contacts · ${noMatch} no-match · ${errors} err · ${rate}/min`);
    }
    await sleep(RATE_MS);
  }

  await client.close();
  console.log(`\n  ✓ done: ${dealersEnriched} dealers enriched, ${contactsAdded} verified contacts added, ${noMatch} no-match, ${errors} errors`);
}

main().catch((e) => { console.error(e); process.exit(1); });
