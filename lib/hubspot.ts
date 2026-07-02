import { getSqlite } from "./db";
import { repEnv, DEFAULT_REP_ID } from "./connections";

/*
 * App-side HubSpot reconciliation. When a rep connects their HubSpot (token saved
 * per-rep via Connections), this matches their HubSpot Companies to our rooftops and
 * OVERLAYS their pipeline on top of ours — lifecycle stage, deal owner, last activity,
 * and their contacts — writing only into Dan (never back to HubSpot). Read-only on
 * their side. Self-contained (raw better-sqlite3) so it runs from a server action with
 * the rep's own token, not a global .env.
 */

const HS = "https://api.hubapi.com";

async function hsFetch<T = unknown>(token: string, path: string, method = "GET"): Promise<{ ok: boolean; status: number; body: T; error?: string }> {
  const res = await fetch(`${HS}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body: body as T, error: res.ok ? undefined : (body as { message?: string })?.message ?? text };
}

async function hsGetAll<T>(token: string, path: string, cap = 2000): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  do {
    const sep = path.includes("?") ? "&" : "?";
    const res = await hsFetch<{ results: T[]; paging?: { next?: { after: string } } }>(token, `${path}${after ? `${sep}after=${after}` : ""}`);
    if (!res.ok) throw new Error(`HubSpot GET ${path} failed (${res.status}): ${res.error}`);
    out.push(...(res.body.results ?? []));
    after = res.body.paging?.next?.after;
  } while (after && out.length < cap);
  return out;
}

/* ---- matching (mirror of the pipeline scorer: domain + brand + city + name overlap) ---- */

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokset = (s: string) => new Set(norm(s).split(" ").filter((t) => t.length > 2));
function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

// Generic + brand words carry no identity — two dealers sharing only "Auto Group" or
// "Nissan" are NOT the same rooftop. A confident name match needs a DISTINCTIVE token.
const GENERIC = new Set([
  "auto", "autos", "group", "motors", "motor", "cars", "car", "dealership", "dealer", "dealers",
  "inc", "llc", "co", "the", "of", "and", "automotive", "sales", "service", "center", "superstore",
  "imports", "import", "usa", "new", "used", "north", "south", "east", "west",
]);
const BRANDS = new Set([
  "ford", "chevrolet", "chevy", "toyota", "honda", "nissan", "lexus", "kia", "hyundai", "subaru",
  "mazda", "volkswagen", "vw", "jeep", "dodge", "ram", "chrysler", "gmc", "buick", "cadillac",
  "acura", "infiniti", "genesis", "porsche", "volvo", "lincoln", "mitsubishi", "mini", "jaguar",
  "land", "rover", "maserati", "bmw", "mercedes", "benz", "audi", "fiat", "alfa", "romeo",
  "tesla", "rivian", "lucid", "polestar", "smart", "scion", "hummer", "saturn", "pontiac",
  "saab", "suzuki", "isuzu", "bentley", "rolls", "royce", "aston", "martin", "mclaren",
  "lamborghini", "ferrari", "lotus",
]);
const distinctive = (t: Set<string>) => new Set([...t].filter((w) => !GENERIC.has(w) && !BRANDS.has(w)));

const LIFECYCLE: Record<string, string> = {
  subscriber: "Subscriber", lead: "Lead", marketingqualifiedlead: "MQL", salesqualifiedlead: "SQL",
  opportunity: "Opportunity", customer: "Customer", evangelist: "Evangelist", other: "Other",
};
function cleanStage(s: string | null | undefined): string | null {
  if (!s) return null;
  const k = s.toLowerCase();
  if (LIFECYCLE[k]) return LIFECYCLE[k];
  if (/^\d+$/.test(s)) return "In pipeline"; // custom numeric stage id — don't show the raw number
  return s;
}

interface DanRoof {
  id: number;
  name: string;
  oem: string | null;
  domain: string | null;
  city: string | null;
  state_province: string | null;
}
interface HsCompany {
  id: string;
  properties: Record<string, string>;
}
interface HsContact {
  id: string;
  properties: Record<string, string>;
  associations?: { companies?: { results: { id: string }[] } };
}
interface HsOwner {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface HubspotSyncResult {
  hsCompanies: number;
  hsContacts: number;
  companiesMatched: number;
  contactsAttached: number;
  unmatched: number;
  examples: Array<{ hsName: string; rooftop: string; stage: string | null; owner: string | null }>;
}

export async function testHubspotToken(token: string): Promise<{ ok: boolean; message: string }> {
  if (!token) return { ok: false, message: "Paste your HubSpot private-app token first." };
  const r = await hsFetch(token, "/crm/v3/objects/companies?limit=1");
  if (r.ok) return { ok: true, message: "Token valid — HubSpot connected." };
  if (r.status === 401) return { ok: false, message: "HubSpot rejected the token (check scopes: crm.objects.companies.read + contacts + owners)." };
  return { ok: false, message: `HubSpot error ${r.status}: ${r.error ?? "unknown"}` };
}

/** Pull the rep's HubSpot, match to our rooftops, overlay stage/owner/activity + contacts. */
export async function syncHubspotForRep(repId = DEFAULT_REP_ID): Promise<HubspotSyncResult> {
  const token = repEnv(repId).HUBSPOT_TOKEN;
  if (!token) throw new Error("No HubSpot token saved for this rep. Connect HubSpot first.");
  const db = getSqlite();

  const owners = await hsGetAll<HsOwner>(token, "/crm/v3/owners?limit=100");
  const ownerName = new Map(owners.map((o) => [o.id, [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || o.id]));

  const companies = await hsGetAll<HsCompany>(token, "/crm/v3/objects/companies?limit=100&properties=name,domain,lifecyclestage,hubspot_owner_id,notes_last_updated");
  const contacts = await hsGetAll<HsContact>(token, "/crm/v3/objects/contacts?limit=100&associations=companies&properties=firstname,lastname,email,jobtitle,phone,hs_lead_status");

  const danRows = db.prepare("SELECT id, name, oem, domain, city, state_province FROM dealerships").all() as DanRoof[];
  const byDomain = new Map<string, DanRoof[]>();
  for (const r of danRows) if (r.domain) (byDomain.get(r.domain) ?? byDomain.set(r.domain, []).get(r.domain)!).push(r);

  // Brands named in the HS company (e.g. "Hall Chrysler Dodge Jeep Ram" → {chrysler,dodge,jeep,ram}).
  const brandsOf = (s: string) => new Set([...tokset(s)].filter((t) => BRANDS.has(t)));
  // A candidate conflicts if the HS name names brand(s), the rooftop has a brand, and they don't intersect.
  const brandConflict = (hsBrands: Set<string>, oem: string | null) => {
    if (!hsBrands.size || !oem) return false;
    const cB = brandsOf(oem);
    return cB.size > 0 && ![...cB].some((b) => hsBrands.has(b));
  };

  function matchCompany(name: string, domainRaw: string): DanRoof | null {
    const domain = (domainRaw || "").toLowerCase().replace(/^www\./, "");
    const hsBrands = brandsOf(name);
    // 1) Domain is the reliable identity key. If several rooftops share one group domain,
    //    disambiguate by brand before trusting it.
    if (domain) {
      const byDom = (byDomain.get(domain) ?? []).filter((c) => !brandConflict(hsBrands, c.oem));
      if (byDom.length === 1) return byDom[0];
      if (byDom.length > 1) {
        const cityHit = byDom.find((c) => c.city && norm(name).includes(norm(c.city)));
        if (cityHit) return cityHit;
        // ambiguous shared domain — fall through to name matching rather than guess
      }
    }
    // 2) Name fallback — conservative. DISTINCTIVE (non-brand, non-generic) token agreement:
    //    two distinctive tokens, or one plus a city; brand must not conflict.
    const hsDist = distinctive(tokset(name));
    if (hsDist.size === 0) return null;
    let best: DanRoof | null = null;
    let bestScore = 0;
    for (const c of danRows) {
      if (brandConflict(hsBrands, c.oem)) continue;
      // The rooftop's own city is not identity — drop it so a real name token must match
      // (kills "Jerry's Ford Alexandria" ↔ "Ourisman Ford of Alexandria").
      const cDist = distinctive(tokset(c.name));
      if (c.city) for (const t of tokset(c.city)) cDist.delete(t);
      if (cDist.size === 0) continue; // brand+city-only name → domain is the only safe key
      const dist = overlap(cDist, hsDist);
      if (dist === 0) continue;
      const city = c.city ? norm(name).includes(norm(c.city)) : false;
      if (!(dist >= 2 || (dist >= 1 && city))) continue;
      const s = dist * 3 + (city ? 2 : 0);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    return best;
  }

  const danByHs = new Map<string, number>();
  const examples: HubspotSyncResult["examples"] = [];
  const updCompany = db.prepare(
    `UPDATE dealerships SET hs_in_crm=1, hubspot_company_id=@hs, hs_lifecycle_stage=@stage,
       hs_owner=@owner, hs_last_activity=@activity, hubspot_synced_at=@now WHERE id=@id`
  );
  const now = new Date().toISOString();
  let companiesMatched = 0;
  const ctx = db.transaction(() => {
    for (const co of companies) {
      const roof = matchCompany(co.properties.name ?? "", co.properties.domain ?? "");
      if (!roof) continue;
      danByHs.set(co.id, roof.id);
      const owner = ownerName.get(co.properties.hubspot_owner_id ?? "") ?? null;
      const stage = cleanStage(co.properties.lifecyclestage);
      updCompany.run({ id: roof.id, hs: co.id, stage, owner, activity: co.properties.notes_last_updated ?? null, now });
      companiesMatched++;
      if (examples.length < 6) examples.push({ hsName: co.properties.name ?? "(unnamed)", rooftop: roof.name, stage, owner });
    }
  });
  ctx();

  // Attach HubSpot contacts to their matched rooftop (merge, refresh prior hubspot ones).
  const byDan = new Map<number, Array<{ name?: string; title?: string; email?: string; phone?: string; source: string }>>();
  let contactsAttached = 0;
  let unmatched = 0;
  for (const ct of contacts) {
    const companyIds = ct.associations?.companies?.results?.map((r) => r.id) ?? [];
    const danId = companyIds.map((cid) => danByHs.get(cid)).find((x) => x != null);
    if (danId == null) {
      unmatched++;
      continue;
    }
    const name = [ct.properties.firstname, ct.properties.lastname].filter(Boolean).join(" ");
    const list = byDan.get(danId) ?? [];
    list.push({ name: name || undefined, title: ct.properties.jobtitle || undefined, email: ct.properties.email || undefined, phone: ct.properties.phone || undefined, source: "hubspot" });
    byDan.set(danId, list);
    contactsAttached++;
  }
  // Contact-domain gate: a HubSpot contact is trustworthy for THIS rooftop only if its email
  // matches the rooftop's own domain, or the canonical domain of a dealer group the rooftop
  // belongs to. Blocks name-collision grafts (a Georgia group's people on an Ontario Toyota)
  // and vendor/OEM emails from wearing a "verified" badge.
  const groupPats = (
    db.prepare("SELECT canonical_domain, name_pattern FROM dealer_groups").all() as { canonical_domain: string; name_pattern: string | null }[]
  ).map((g) => ({ dom: g.canonical_domain, re: g.name_pattern ? new RegExp(g.name_pattern, "i") : null }));
  const roofById = new Map(danRows.map((dr) => [dr.id, { domain: dr.domain, name: dr.name }]));
  const dsld = (h?: string | null) => {
    if (!h) return null;
    const s = String(h).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const p = s.split(".");
    return p.length < 2 ? null : p.slice(-2).join(".");
  };
  const getC = db.prepare("SELECT contacts FROM dealerships WHERE id=?");
  const setC = db.prepare("UPDATE dealerships SET contacts=@c, updated_at=CURRENT_TIMESTAMP WHERE id=@id");
  db.transaction(() => {
    for (const [danId, hsContacts] of byDan) {
      const roof = roofById.get(danId);
      const roofSld = dsld(roof?.domain);
      const nm = (roof?.name ?? "").toLowerCase();
      // Which group canonical domains does this rooftop belong to?
      const member = new Set<string>();
      for (const g of groupPats) {
        const byName = g.re ? g.re.test(nm) : false;
        const byMulti = hsContacts.filter((c) => c.email && dsld(c.email.split("@")[1]) === g.dom).length >= 2;
        if (byName || byMulti) member.add(g.dom);
      }
      const gated = hsContacts.filter((c) => {
        if (!c.email) return true;
        const es = dsld(c.email.split("@")[1]);
        if (es && roofSld && es === roofSld) return true; // exact store domain
        if (es && member.has(es)) return true; // parent group's canonical domain
        return false; // wrong-store / vendor / OEM
      });
      let existing: Array<{ email?: string; name?: string; source?: string }> = [];
      try {
        existing = JSON.parse((getC.get(danId) as { contacts: string } | undefined)?.contacts ?? "[]");
      } catch {}
      const kept = existing.filter((c) => c.source !== "hubspot");
      const seen = new Set(kept.map((c) => (c.email ?? c.name ?? "").toLowerCase()));
      for (const c of gated) {
        const key = (c.email ?? c.name ?? "").toLowerCase();
        if (key && seen.has(key)) continue;
        seen.add(key);
        kept.push(c);
      }
      setC.run({ id: danId, c: JSON.stringify(kept) });
    }
  })();

  return { hsCompanies: companies.length, hsContacts: contacts.length, companiesMatched, contactsAttached, unmatched, examples };
}
