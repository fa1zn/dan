import { CONFIG } from "../config";
import { getSqlite } from "../../lib/db";

/*
 * Two-way HubSpot sync.
 *
 *   push : Dan rooftops + decision-makers  ->  HubSpot Companies + Contacts
 *   pull : HubSpot status/owner changes    ->  Dan's CRM
 *   sync : push then pull
 *
 * Every run is a DRY RUN unless HUBSPOT_APPLY=1, so it's safe to inspect the plan
 * with no token. Companies upsert by domain (matching Pam's existing records) or by
 * a unique dan_account_id; contacts upsert by a stable dan_contact_id. Dedupe is
 * therefore idempotent — re-running updates rather than duplicates.
 */

const HS = "https://api.hubapi.com";

interface HsResult<T = unknown> {
  ok: boolean;
  status: number;
  body: T;
  error?: string;
}

async function hsFetch<T = unknown>(path: string, method: string, body?: unknown): Promise<HsResult<T>> {
  if (!CONFIG.hubspot.token) throw new Error("HUBSPOT_TOKEN is not set — required for apply/pull.");
  const res = await fetch(`${HS}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CONFIG.hubspot.token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return {
    ok: res.ok,
    status: res.status,
    body: parsed as T,
    error: res.ok ? undefined : (parsed as { message?: string })?.message ?? text,
  };
}

/* ---------- custom properties ---------- */

interface PropDef {
  name: string;
  label: string;
  group: string;
  unique?: boolean;
}

const COMPANY_PROPS: PropDef[] = [
  { name: "dan_account_id", label: "Dan Account ID", group: "companyinformation", unique: true },
  { name: "dan_oem", label: "Dan OEM Brand", group: "companyinformation" },
  { name: "dan_tier", label: "Dan Tier", group: "companyinformation" },
  { name: "dan_territory", label: "Dan Territory", group: "companyinformation" },
  { name: "dan_status", label: "Dan Pipeline Status", group: "companyinformation" },
  { name: "dan_tech_stack", label: "Dan Tech Stack", group: "companyinformation" },
  { name: "dan_url", label: "Dan Account URL", group: "companyinformation" },
];
const CONTACT_PROPS: PropDef[] = [
  { name: "dan_contact_id", label: "Dan Contact ID", group: "contactinformation", unique: true },
];

async function ensureProps(objectType: "companies" | "contacts", defs: PropDef[]): Promise<void> {
  for (const d of defs) {
    const existing = await hsFetch(`/crm/v3/properties/${objectType}/${d.name}`, "GET");
    if (existing.ok) continue;
    const created = await hsFetch(`/crm/v3/properties/${objectType}`, "POST", {
      name: d.name,
      label: d.label,
      type: "string",
      fieldType: "text",
      groupName: d.group,
      hasUniqueValue: d.unique ?? false,
    });
    if (!created.ok) throw new Error(`Failed creating property ${objectType}.${d.name}: ${created.error}`);
    console.log(`  [hubspot] created property ${objectType}.${d.name}`);
  }
}

/* ---------- the sync set ---------- */

interface SyncContact {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  source?: string;
}
interface SyncRow {
  id: number;
  name: string;
  oem: string | null;
  domain: string | null;
  website: string | null;
  phone: string | null;
  address_street: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  territory: string | null;
  tier: string | null;
  tools_used: string | null;
  contacts: string | null;
  hubspot_company_id: string | null;
  status: string;
  owner: string | null;
  people: SyncContact[];
  tools: string[];
}

function selectSyncSet(): SyncRow[] {
  const db = getSqlite();
  const regions = CONFIG.hubspot.regions.map((r) => r.toUpperCase());
  const placeholders = regions.map(() => "?").join(",");
  const enrichedClause = CONFIG.hubspot.onlyEnriched ? "AND d.contacts != '[]'" : "";
  const rows = db
    .prepare(
      `SELECT d.id, d.name, d.oem, d.domain, d.website, d.phone, d.address_street, d.city,
              d.state_province, d.postal_code, d.country, d.territory, d.tier, d.tools_used,
              d.contacts, d.hubspot_company_id, COALESCE(c.status,'new') AS status, c.owner AS owner
       FROM dealerships d LEFT JOIN account_crm c ON c.dealership_id = d.id
       WHERE d.state_province IN (${placeholders}) ${enrichedClause}
       ORDER BY d.name`
    )
    .all(...regions) as (Record<string, unknown> & { contacts: string | null; tools_used: string | null })[];

  return rows.map((r) => {
    let people: SyncContact[] = [];
    let tools: string[] = [];
    try {
      people = JSON.parse(r.contacts ?? "[]");
    } catch {}
    try {
      tools = JSON.parse(r.tools_used ?? "[]");
    } catch {}
    return { ...(r as unknown as SyncRow), people, tools };
  });
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function companyProperties(r: SyncRow): Record<string, string> {
  const props: Record<string, string> = {
    name: r.name,
    dan_account_id: String(r.id),
    dan_oem: r.oem ?? "",
    dan_tier: r.tier ?? "",
    dan_territory: r.territory ?? "",
    dan_status: r.status,
    dan_tech_stack: r.tools.join("; "),
    dan_url: `${CONFIG.hubspot.appBaseUrl}/accounts/${r.id}`,
  };
  if (r.domain) props.domain = r.domain;
  if (r.website) props.website = r.website;
  if (r.phone) props.phone = r.phone;
  if (r.address_street) props.address = r.address_street;
  if (r.city) props.city = r.city;
  if (r.state_province) props.state = r.state_province;
  if (r.postal_code) props.zip = r.postal_code;
  if (r.country) props.country = r.country;
  return props;
}

/* ---------- push ---------- */

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

interface PushStats {
  companies: number;
  contacts: number;
  associations: number;
}

export async function pushToHubspot(apply: boolean): Promise<PushStats> {
  const set = selectSyncSet();
  const peopleTotal = set.reduce((n, r) => n + r.people.filter((p) => p.name || p.email).length, 0);
  console.log(
    `  [hubspot] sync set: ${set.length} companies in ${CONFIG.hubspot.regions.join("/")}` +
      `${CONFIG.hubspot.onlyEnriched ? " (enriched only)" : ""}, ${peopleTotal} contacts`
  );

  if (!apply) {
    console.log("  [hubspot] DRY RUN — nothing written. Sample of what would be pushed:");
    set.slice(0, 3).forEach((r) => {
      console.log(`    • Company "${r.name}"  domain=${r.domain ?? "(none)"}  tier=${r.tier} status=${r.status}`);
      console.log(`        tech: ${r.tools.join(", ") || "(none)"}`);
      r.people.filter((p) => p.name).slice(0, 3).forEach((p) => console.log(`        contact: ${p.name} — ${p.title ?? "?"}  ${p.phone ?? p.email ?? ""}`));
    });
    console.log(`  [hubspot] set HUBSPOT_APPLY=1 (with HUBSPOT_TOKEN) to push for real.`);
    return { companies: set.length, contacts: peopleTotal, associations: peopleTotal };
  }

  const db = getSqlite();
  await ensureProps("companies", COMPANY_PROPS);
  await ensureProps("contacts", CONTACT_PROPS);

  // Companies: upsert by domain when present (matches existing HubSpot records), else by dan_account_id.
  const withDomain = set.filter((r) => r.domain);
  const noDomain = set.filter((r) => !r.domain);
  const companyIdByDan = new Map<number, string>();

  const upsertCompanies = async (rows: SyncRow[], idProperty: "domain" | "dan_account_id") => {
    for (const batch of chunk(rows, CONFIG.hubspot.batchSize)) {
      const inputs = batch.map((r) => ({
        idProperty,
        id: idProperty === "domain" ? r.domain! : String(r.id),
        properties: companyProperties(r),
      }));
      const res = await hsFetch<{ results: { id: string; properties: Record<string, string> }[] }>(
        "/crm/v3/objects/companies/batch/upsert",
        "POST",
        { inputs }
      );
      if (!res.ok) throw new Error(`company upsert failed: ${res.error}`);
      for (const result of res.body.results ?? []) {
        const danId = Number(result.properties.dan_account_id);
        if (danId) companyIdByDan.set(danId, result.id);
      }
    }
  };
  await upsertCompanies(withDomain, "domain");
  await upsertCompanies(noDomain, "dan_account_id");

  // Persist the mapping back to Dan.
  const now = new Date().toISOString();
  const upd = db.prepare("UPDATE dealerships SET hubspot_company_id=@hs, hubspot_synced_at=@t WHERE id=@id");
  const tx = db.transaction(() => {
    for (const [danId, hsId] of companyIdByDan) upd.run({ id: danId, hs: hsId, t: now });
  });
  tx();
  console.log(`  [hubspot] upserted ${companyIdByDan.size} companies`);

  // Contacts: upsert by stable dan_contact_id, then associate to the company.
  const contactInputs: { danId: number; dcid: string; properties: Record<string, string> }[] = [];
  for (const r of set) {
    for (const p of r.people) {
      if (!p.name && !p.email) continue;
      const [first, ...rest] = (p.name ?? "").split(" ");
      const dcid = `${r.id}-${slug(p.name ?? p.email ?? "contact")}`;
      const props: Record<string, string> = { dan_contact_id: dcid };
      if (first) props.firstname = first;
      if (rest.length) props.lastname = rest.join(" ");
      if (p.title) props.jobtitle = p.title;
      if (p.email) props.email = p.email;
      if (p.phone) props.phone = p.phone;
      contactInputs.push({ danId: r.id, dcid, properties: props });
    }
  }

  const contactIdByDcid = new Map<string, string>();
  for (const batch of chunk(contactInputs, CONFIG.hubspot.batchSize)) {
    const res = await hsFetch<{ results: { id: string; properties: Record<string, string> }[] }>(
      "/crm/v3/objects/contacts/batch/upsert",
      "POST",
      { inputs: batch.map((c) => ({ idProperty: "dan_contact_id", id: c.dcid, properties: c.properties })) }
    );
    if (!res.ok) throw new Error(`contact upsert failed: ${res.error}`);
    for (const result of res.body.results ?? []) {
      const dcid = result.properties.dan_contact_id;
      if (dcid) contactIdByDcid.set(dcid, result.id);
    }
  }
  console.log(`  [hubspot] upserted ${contactIdByDcid.size} contacts`);

  // Associate contacts to their company (v4 default association).
  let associations = 0;
  for (const c of contactInputs) {
    const contactId = contactIdByDcid.get(c.dcid);
    const companyId = companyIdByDan.get(c.danId);
    if (!contactId || !companyId) continue;
    const res = await hsFetch(
      `/crm/v4/objects/contacts/${contactId}/associations/default/companies/${companyId}`,
      "PUT"
    );
    if (res.ok) associations++;
  }
  console.log(`  [hubspot] associated ${associations} contacts to companies`);

  return { companies: companyIdByDan.size, contacts: contactIdByDcid.size, associations };
}

/* ---------- pull (HubSpot -> Dan), READ-ONLY ---------- */

async function hsGetAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  do {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${path}${after ? `${sep}after=${after}` : ""}`;
    const res = await hsFetch<{ results: T[]; paging?: { next?: { after: string } } }>(url, "GET");
    if (!res.ok) throw new Error(`GET ${path} failed (${res.status}): ${res.error}`);
    out.push(...(res.body.results ?? []));
    after = res.body.paging?.next?.after;
  } while (after);
  return out;
}

interface HsOwner {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}
interface HsObject {
  id: string;
  properties: Record<string, string>;
  associations?: { companies?: { results: { id: string }[] } };
}
interface DanRoof {
  id: number;
  name: string;
  oem: string | null;
  domain: string | null;
  city: string | null;
  state_province: string | null;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string) => new Set(norm(s).split(" ").filter((t) => t.length > 2));
function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

interface PullStats {
  hsCompanies: number;
  hsContacts: number;
  companiesMatched: number;
  contactsMatched: number;
  contactsUnmatched: number;
}

export async function pullFromHubspot(): Promise<PullStats> {
  const db = getSqlite();

  // 1) owner id -> display name
  const owners = await hsGetAll<HsOwner>("/crm/v3/owners?limit=100");
  const ownerName = new Map(
    owners.map((o) => [o.id, [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || o.id])
  );

  // 2) companies and contacts (contacts carry their company associations)
  const companies = await hsGetAll<HsObject>(
    "/crm/v3/objects/companies?limit=100&properties=name,domain,lifecyclestage,hubspot_owner_id,notes_last_updated"
  );
  const contacts = await hsGetAll<HsObject>(
    "/crm/v3/objects/contacts?limit=100&associations=companies&properties=firstname,lastname,email,jobtitle,phone,lifecyclestage,hs_lead_status,hubspot_owner_id"
  );
  console.log(`  [hubspot] fetched ${companies.length} companies, ${contacts.length} contacts, ${owners.length} owners`);

  // Dan rooftops, indexed by domain for fast candidate lookup.
  const danRows = db
    .prepare("SELECT id, name, oem, domain, city, state_province FROM dealerships")
    .all() as DanRoof[];
  const byDomain = new Map<string, DanRoof[]>();
  for (const r of danRows) {
    if (r.domain) (byDomain.get(r.domain) ?? byDomain.set(r.domain, []).get(r.domain)!).push(r);
  }

  // Score an HS company against Dan rooftops; prefer domain + oem + city signals so a
  // group domain (e.g. one site for many stores) still resolves to the right rooftop.
  function matchCompany(name: string, domainRaw: string): number | null {
    const domain = domainRaw.toLowerCase().replace(/^www\./, "");
    const hsTok = tokens(name);
    let candidates = (domain && byDomain.get(domain)) || [];
    if (candidates.length === 0 && hsTok.size) {
      candidates = danRows.filter((r) => overlap(tokens(r.name), hsTok) >= 2);
    }
    let best: DanRoof | null = null;
    let bestScore = 0;
    for (const c of candidates) {
      let s = 0;
      if (domain && c.domain === domain) s += 2;
      if (c.oem && norm(name).includes(c.oem.toLowerCase())) s += 2;
      if (c.city && norm(name).includes(norm(c.city))) s += 2;
      s += overlap(tokens(c.name), hsTok);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    return best && bestScore >= 2 ? best.id : null;
  }

  // Map every HS company -> Dan rooftop, and write the engagement summary.
  const danByHsCompany = new Map<string, number>();
  const updCompany = db.prepare(
    `UPDATE dealerships SET hs_in_crm=1, hubspot_company_id=@hs, hs_lifecycle_stage=@stage,
       hs_owner=@owner, hs_last_activity=@activity, hubspot_synced_at=@now WHERE id=@id`
  );
  let companiesMatched = 0;
  const now = new Date().toISOString();
  const ctx = db.transaction(() => {
    for (const co of companies) {
      const danId = matchCompany(co.properties.name ?? "", co.properties.domain ?? "");
      if (!danId) continue;
      danByHsCompany.set(co.id, danId);
      updCompany.run({
        id: danId,
        hs: co.id,
        stage: co.properties.lifecyclestage ?? null,
        owner: ownerName.get(co.properties.hubspot_owner_id ?? "") ?? null,
        activity: co.properties.notes_last_updated ?? null,
        now,
      });
      companiesMatched++;
    }
  });
  ctx();

  // Attach HubSpot contacts to their matched rooftop (real emails + owner-known leads).
  const hsContactsByDan = new Map<number, SyncContact[]>();
  let contactsMatched = 0;
  let contactsUnmatched = 0;
  for (const ct of contacts) {
    const companyIds = ct.associations?.companies?.results?.map((r) => r.id) ?? [];
    const danId = companyIds.map((cid) => danByHsCompany.get(cid)).find((x) => x != null);
    const name = [ct.properties.firstname, ct.properties.lastname].filter(Boolean).join(" ");
    if (danId == null) {
      contactsUnmatched++;
      continue;
    }
    const list = hsContactsByDan.get(danId) ?? [];
    list.push({
      name: name || undefined,
      title: ct.properties.jobtitle || undefined,
      email: ct.properties.email || undefined,
      phone: ct.properties.phone || undefined,
      source: "hubspot",
    });
    hsContactsByDan.set(danId, list);
    contactsMatched++;
  }

  // Merge HubSpot contacts into each rooftop's contacts JSON (refresh prior hubspot ones).
  const getContacts = db.prepare("SELECT contacts FROM dealerships WHERE id=?");
  const setContacts = db.prepare("UPDATE dealerships SET contacts=@c, updated_at=CURRENT_TIMESTAMP WHERE id=@id");
  const mergeTx = db.transaction(() => {
    for (const [danId, hsContacts] of hsContactsByDan) {
      let existing: SyncContact[] = [];
      try {
        existing = JSON.parse((getContacts.get(danId) as { contacts: string } | undefined)?.contacts ?? "[]");
      } catch {}
      const kept = existing.filter((c) => c.source !== "hubspot");
      const seen = new Set(kept.map((c) => (c.email ?? c.name ?? "").toLowerCase()));
      for (const c of hsContacts) {
        const key = (c.email ?? c.name ?? "").toLowerCase();
        if (key && seen.has(key)) continue;
        seen.add(key);
        kept.push(c);
      }
      setContacts.run({ id: danId, c: JSON.stringify(kept) });
    }
  });
  mergeTx();

  return {
    hsCompanies: companies.length,
    hsContacts: contacts.length,
    companiesMatched,
    contactsMatched,
    contactsUnmatched,
  };
}

export async function runHubspot(direction: string): Promise<void> {
  // Writes are off by default — Dan only pulls Pam's data in.
  if (direction === "push" || direction === "sync") {
    if (!CONFIG.hubspot.allowWrite) {
      throw new Error(
        "Writing to HubSpot is disabled (read-only mode). Dan only pulls from HubSpot. " +
          "Run `hubspot:pull`, or set HUBSPOT_ALLOW_WRITE=1 to opt into pushing."
      );
    }
    console.log(`\n▶ HUBSPOT PUSH (${CONFIG.hubspot.apply ? "APPLY" : "DRY RUN"})`);
    await pushToHubspot(CONFIG.hubspot.apply);
    if (direction === "push") return;
  }

  // default + pull/sync
  if (!CONFIG.hubspot.token) throw new Error("HUBSPOT_TOKEN is not set — required to pull from HubSpot.");
  console.log("\n▶ HUBSPOT PULL (read-only — reads HubSpot, writes only to Dan)");
  const r = await pullFromHubspot();
  console.log(
    `  ✓ ${r.companiesMatched}/${r.hsCompanies} HubSpot companies matched to Dan rooftops; ` +
      `${r.contactsMatched} contacts attached (${r.contactsUnmatched} unmatched)`
  );
}
