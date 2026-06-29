import { CONFIG } from "../config";
import { getSqlite } from "../../lib/db";
import { computePamFit } from "../../lib/pamfit";
import type { Contact } from "../../lib/types";

/*
 * ZoomInfo enrichment (PAID). Takes the decision-makers Dan already found by name
 * and gets their DIRECT phone + verified email — the "call the GM's cell, not the
 * front desk" upgrade. Credit-safe by design:
 *   - DRY RUN unless ZOOMINFO_APPLY=1 (dry run makes no API calls, spends nothing).
 *   - Scoped to ZOOMINFO_REGIONS, capped at ZOOMINFO_MAX_ACCOUNTS, highest Pam-fit
 *     first, optionally floored at ZOOMINFO_MIN_FIT — so credits hit the best accounts.
 */

const ZI = "https://api.zoominfo.com";

async function authenticate(): Promise<string> {
  const { username, password } = CONFIG.zoominfo;
  if (!username || !password) {
    throw new Error("ZOOMINFO_USERNAME / ZOOMINFO_PASSWORD not set (see docs/zoominfo-setup.md).");
  }
  const res = await fetch(`${ZI}/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = (await res.json().catch(() => ({}))) as { jwt?: string; message?: string };
  if (!res.ok || !body.jwt) throw new Error(`ZoomInfo auth failed (${res.status}): ${body.message ?? "no jwt"}`);
  return body.jwt;
}

interface Candidate {
  id: number;
  name: string;
  domain: string | null;
  people: { name?: string; title?: string; source?: string }[];
  existing: Contact[];
  score: number;
}

function selectCandidates(): Candidate[] {
  const db = getSqlite();
  const regions = CONFIG.zoominfo.regions.map((r) => r.toUpperCase());
  const ph = regions.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT id, name, domain, contacts, tools_used, enrichment, phone, phone_valid, website, website_valid, brand_confirmed, tier
       FROM dealerships
       WHERE state_province IN (${ph}) AND contacts LIKE '%staff-page%'`
    )
    .all(...regions) as Record<string, unknown>[];

  const cands: Candidate[] = [];
  for (const r of rows) {
    let contacts: Contact[] = [];
    let tools: string[] = [];
    let signals: { rating?: number; reviewCount?: number; hours?: string } = {};
    try {
      contacts = JSON.parse((r.contacts as string) ?? "[]");
    } catch {}
    try {
      tools = JSON.parse((r.tools_used as string) ?? "[]");
    } catch {}
    try {
      signals = JSON.parse((r.enrichment as string) ?? "{}");
    } catch {}
    const people = contacts.filter((c) => c.name && c.source === "staff-page");
    if (!people.length) continue;
    const fit = computePamFit({
      contacts: people,
      tools,
      signals,
      phone: (r.phone as string) ?? null,
      phoneValid: r.phone_valid === 1,
      website: (r.website as string) ?? null,
      websiteValid: r.website_valid == null ? null : r.website_valid === 1,
      brandConfirmed: r.brand_confirmed === 1,
      tier: (r.tier as string) ?? null,
    });
    if (fit.score < CONFIG.zoominfo.minPamFit) continue;
    cands.push({ id: r.id as number, name: r.name as string, domain: (r.domain as string) ?? null, people, existing: contacts, score: fit.score });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands.slice(0, CONFIG.zoominfo.maxAccounts > 0 ? CONFIG.zoominfo.maxAccounts : cands.length);
}

/** Enrich one rooftop's people via ZoomInfo Contact Enrich. */
async function enrichPeople(jwt: string, cand: Candidate): Promise<Contact[]> {
  const input = cand.people.slice(0, 10).map((p) => {
    const [firstName, ...rest] = (p.name ?? "").split(" ");
    return { firstName, lastName: rest.join(" "), companyName: cand.name, companyDomain: cand.domain ?? undefined };
  });
  const res = await fetch(`${ZI}/enrich/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({
      matchPersonInput: input,
      outputFields: ["firstName", "lastName", "jobTitle", "email", "phone", "directPhone", "mobilePhone"],
    }),
  });
  if (!res.ok) throw new Error(`ZoomInfo enrich failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { data?: { result?: { data?: Record<string, unknown>[] }[] } };

  const out: Contact[] = [];
  for (const r of body.data?.result ?? []) {
    for (const person of r.data ?? []) {
      const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
      const phone = (person.directPhone || person.mobilePhone || person.phone) as string | undefined;
      const email = person.email as string | undefined;
      if (!name || (!phone && !email)) continue;
      out.push({ name, title: (person.jobTitle as string) || undefined, phone, email, source: "zoominfo" });
    }
  }
  return out;
}

function mergeAndStore(id: number, existing: Contact[], found: Contact[]) {
  const kept = existing.filter((c) => c.source !== "zoominfo");
  const byKey = new Map(kept.map((c) => [(c.email ?? c.name ?? "").toLowerCase(), c]));
  for (const c of found) byKey.set((c.email ?? c.name ?? "").toLowerCase(), { ...byKey.get((c.email ?? c.name ?? "").toLowerCase()), ...c });
  getSqlite()
    .prepare("UPDATE dealerships SET contacts=@c, updated_at=CURRENT_TIMESTAMP WHERE id=@id")
    .run({ id, c: JSON.stringify([...byKey.values()]) });
}

export async function runZoomInfo(): Promise<void> {
  const apply = CONFIG.zoominfo.apply;
  const cands = selectCandidates();
  const peopleTotal = cands.reduce((n, c) => n + Math.min(c.people.length, 10), 0);

  console.log(`\n▶ ZOOMINFO ENRICH (${apply ? "APPLY" : "DRY RUN"})`);
  console.log(
    `  scope: ${CONFIG.zoominfo.regions.join("/")}, top ${cands.length} accounts by Pam-fit, ${peopleTotal} contacts to enrich`
  );

  if (!apply) {
    console.log(`  DRY RUN — no API calls, no credits spent. ~${peopleTotal} contact-enrich credits would be used.`);
    cands.slice(0, 5).forEach((c) => console.log(`    • ${c.name} (fit ${c.score}) — ${c.people.length} people`));
    console.log("  Set ZOOMINFO_APPLY=1 (with credentials) to enrich for real.");
    return;
  }

  const jwt = await authenticate();
  let enriched = 0;
  let contactsAdded = 0;
  for (const cand of cands) {
    try {
      const found = await enrichPeople(jwt, cand);
      if (found.length) {
        mergeAndStore(cand.id, cand.existing, found);
        enriched++;
        contactsAdded += found.length;
      }
    } catch (err) {
      console.error(`  [zoominfo] ${cand.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`  ✓ enriched ${enriched} accounts, added/updated ${contactsAdded} direct contacts (source: zoominfo)`);
}
