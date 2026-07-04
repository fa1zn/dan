import { getSqlite } from "./db";
import { computePamFit } from "./pamfit";
import { detectGroup } from "./groups";

/* These run only in Server Components / route handlers (better-sqlite3 is native). */

export interface Kpis {
  total: number;
  us: number;
  ca: number;
  tierA: number;
  withWebsite: number;
  websiteChecked: number;
  websiteValid: number;
  withPhone: number;
  phoneValid: number;
  brandConfirmed: number;
  inHubspot: number;
}

export function getKpis(): Kpis {
  const db = getSqlite();
  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(country='US') AS us,
        SUM(country='CA') AS ca,
        SUM(tier='A') AS tierA,
        SUM(website IS NOT NULL) AS withWebsite,
        SUM(website_valid IS NOT NULL) AS websiteChecked,
        SUM(website_valid=1) AS websiteValid,
        SUM(phone IS NOT NULL) AS withPhone,
        SUM(phone_valid=1) AS phoneValid,
        SUM(brand_confirmed=1) AS brandConfirmed,
        SUM(hs_in_crm=1) AS inHubspot
      FROM dealerships`
    )
    .get() as Record<string, number>;
  return {
    total: row.total ?? 0,
    us: row.us ?? 0,
    ca: row.ca ?? 0,
    tierA: row.tierA ?? 0,
    withWebsite: row.withWebsite ?? 0,
    websiteChecked: row.websiteChecked ?? 0,
    websiteValid: row.websiteValid ?? 0,
    withPhone: row.withPhone ?? 0,
    phoneValid: row.phoneValid ?? 0,
    brandConfirmed: row.brandConfirmed ?? 0,
    inHubspot: row.inHubspot ?? 0,
  };
}

export interface Tally {
  label: string;
  n: number;
}

export function getByOem(limit = 15): Tally[] {
  return getSqlite()
    .prepare(
      `SELECT COALESCE(oem,'(unknown)') AS label, COUNT(*) AS n
       FROM dealerships GROUP BY oem ORDER BY n DESC LIMIT ?`
    )
    .all(limit) as Tally[];
}

export function getByTerritory(): Tally[] {
  return getSqlite()
    .prepare(
      `SELECT COALESCE(territory,'(unknown)') AS label, COUNT(*) AS n
       FROM dealerships GROUP BY territory ORDER BY n DESC`
    )
    .all() as Tally[];
}

export function getByTier(): Tally[] {
  return getSqlite()
    .prepare(
      `SELECT CASE WHEN tier IS NULL THEN '(untiered)' ELSE 'Tier '||tier END AS label, COUNT(*) AS n
       FROM dealerships GROUP BY tier ORDER BY n DESC`
    )
    .all() as Tally[];
}

export interface FilterOptions {
  oems: string[];
  countries: string[];
  territories: string[];
  states: string[];
  tiers: string[];
}

export function getFilterOptions(): FilterOptions {
  const db = getSqlite();
  const col = (sql: string) => (db.prepare(sql).all() as { v: string }[]).map((r) => r.v).filter(Boolean);
  return {
    oems: col("SELECT DISTINCT oem AS v FROM dealerships WHERE oem IS NOT NULL ORDER BY oem"),
    countries: col("SELECT DISTINCT country AS v FROM dealerships WHERE country IS NOT NULL ORDER BY country"),
    territories: col("SELECT DISTINCT territory AS v FROM dealerships WHERE territory IS NOT NULL ORDER BY territory"),
    states: col("SELECT DISTINCT state_province AS v FROM dealerships WHERE state_province IS NOT NULL ORDER BY state_province"),
    tiers: col("SELECT DISTINCT tier AS v FROM dealerships WHERE tier IS NOT NULL ORDER BY tier"),
  };
}

export interface AccountFilters {
  q?: string;
  oem?: string[];
  country?: string;
  territory?: string;
  state?: string;
  tier?: string;
  status?: string;
  hasWebsite?: boolean;
  hasPhone?: boolean;
  brandConfirmed?: boolean;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface AccountRow {
  id: number;
  name: string;
  oem: string | null;
  group_name: string | null;
  tier: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  territory: string | null;
  website: string | null;
  domain: string | null;
  phone: string | null;
  website_valid: number | null;
  phone_valid: number | null;
  brand_confirmed: number;
  status: string;
  owner: string | null;
  hs_in_crm: number;
  hs_lifecycle_stage: string | null;
  hs_owner: string | null;
}

const FROM = "FROM dealerships d LEFT JOIN account_crm c ON c.dealership_id = d.id";
const SELECT_COLS = `d.id, d.name, d.oem, d.group_name, d.tier, d.city, d.state_province, d.country, d.territory,
  d.website, d.domain, d.phone, d.website_valid, d.phone_valid, d.brand_confirmed,
  d.hs_in_crm, d.hs_lifecycle_stage, d.hs_owner,
  COALESCE(c.status,'new') AS status, c.owner AS owner`;

const SORTABLE: Record<string, string> = {
  name: "d.name",
  oem: "d.oem",
  city: "d.city",
  state_province: "d.state_province",
  country: "d.country",
  tier: "d.tier",
  status: "COALESCE(c.status,'new')",
};

/** Build the shared WHERE clause + params from filters. */
function whereClause(f: AccountFilters): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (f.q) {
    clauses.push("(name LIKE ? OR city LIKE ? OR domain LIKE ?)");
    const like = `%${f.q}%`;
    params.push(like, like, like);
  }
  if (f.oem?.length) {
    clauses.push(`oem IN (${f.oem.map(() => "?").join(",")})`);
    params.push(...f.oem);
  }
  if (f.country) {
    clauses.push("country = ?");
    params.push(f.country);
  }
  if (f.territory) {
    clauses.push("territory = ?");
    params.push(f.territory);
  }
  if (f.state) {
    clauses.push("d.state_province = ?");
    params.push(f.state.toUpperCase());
  }
  if (f.tier) {
    clauses.push("d.tier = ?");
    params.push(f.tier);
  }
  if (f.status) {
    clauses.push("COALESCE(c.status,'new') = ?");
    params.push(f.status);
  }
  if (f.hasWebsite) clauses.push("website IS NOT NULL");
  if (f.hasPhone) clauses.push("phone IS NOT NULL");
  if (f.brandConfirmed) clauses.push("brand_confirmed = 1");

  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export interface AccountPage {
  rows: AccountRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function listAccounts(f: AccountFilters): AccountPage {
  const db = getSqlite();
  const { sql: where, params } = whereClause(f);

  const total = (db.prepare(`SELECT COUNT(*) AS n ${FROM} ${where}`).get(...params) as { n: number }).n;

  const pageSize = f.pageSize ?? 25;
  const page = Math.max(1, f.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const offset = (Math.min(page, pageCount) - 1) * pageSize;

  const sort = (f.sort && SORTABLE[f.sort]) || "d.name";
  const dir = f.dir === "desc" ? "DESC" : "ASC";

  const rows = db
    .prepare(`SELECT ${SELECT_COLS} ${FROM} ${where} ORDER BY ${sort} ${dir}, d.name ASC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as AccountRow[];

  return { rows, total, page, pageSize, pageCount };
}

/** All matching rows (no pagination), used by CSV export of the filtered view. */
export function listAllAccounts(f: AccountFilters): AccountRow[] {
  const db = getSqlite();
  const { sql: where, params } = whereClause(f);
  const sort = (f.sort && SORTABLE[f.sort]) || "d.name";
  const dir = f.dir === "desc" ? "DESC" : "ASC";
  return db
    .prepare(`SELECT ${SELECT_COLS} ${FROM} ${where} ORDER BY ${sort} ${dir}, d.name ASC`)
    .all(...params) as AccountRow[];
}

export interface FullAccount extends AccountRow {
  address_street: string | null;
  postal_code: string | null;
  email: string | null;
  group_size: number | null;
  tools_used: string | null;
  contacts: string | null;
  place_id: string | null;
  source: string;
  dedup_key: string;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
  hs_in_crm: number;
  hs_lifecycle_stage: string | null;
  hs_owner: string | null;
  hs_last_activity: string | null;
  enrichment: string | null;
}

/* ---------- Rep call list (territory worklist) ---------- */

export interface Person {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  phoneDnc?: boolean;
  mobileDnc?: boolean;
  source?: string;
}

export interface CallListItem {
  id: number;
  name: string;
  oem: string | null;
  tier: string | null;
  status: string;
  city: string | null;
  state_province: string | null;
  address_street: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  hs_in_crm: number;
  hs_owner: string | null;
  primary: Person | null;
  people: Person[];
  rating: number | null;
  reviewCount: number | null;
  pamfit: { score: number; band: "Hot" | "Warm" | "Cool"; talkTrack: string; opener: string; askFor: string };
  whyNow: { label: string; tone: "hot" | "info" | "warn" }[];
}

// Tech a dealer runs that Pam can displace or sits adjacent to (chat / AI / call-handling).
const DISPLACE_TECH = /(gubagoo|activengage|podium|livile|conversica|car ?now|driftrock|callrail|invoca|dealersocket|cdk|vinsolutions|autofi|roadster|digital ?retail)/i;

/** Concrete "why call them now" triggers synthesized from the signals we actually have. */
function whyNowReasons(args: {
  rating: number | null; reviewCount: number | null; tools: string[]; people: Person[];
  metaAds?: { active?: boolean; count?: number }; hasDirect: boolean;
}): { label: string; tone: "hot" | "info" | "warn" }[] {
  const out: { label: string; tone: "hot" | "info" | "warn" }[] = [];
  if (args.metaAds?.active) out.push({ label: `Running Meta ads${args.metaAds.count ? ` (${args.metaAds.count})` : ""}, active lead-gen spend`, tone: "hot" });
  if (args.rating != null && args.rating < 4.0) out.push({ label: `Reviews ${args.rating}★${args.reviewCount ? ` (${args.reviewCount})` : ""}, service-recovery opener`, tone: "warn" });
  if (args.rating != null && args.rating >= 4.5 && (args.reviewCount ?? 0) >= 500) out.push({ label: `High-volume store (${args.rating}★, ${args.reviewCount} reviews)`, tone: "info" });
  const tech = args.tools.find((t) => DISPLACE_TECH.test(t));
  if (tech) out.push({ label: `Runs ${tech}, displacement angle`, tone: "info" });
  if (args.hasDirect) out.push({ label: "Direct line on file", tone: "hot" });
  if (args.people.length >= 3) out.push({ label: `${args.people.length} decision-makers mapped`, tone: "info" });
  return out.slice(0, 3);
}

// Who a rep most wants to reach, in priority order.
const TITLE_RANK = [
  "general manager",
  "dealer principal",
  "owner",
  "president",
  "managing partner",
  "general sales manager",
  "director of sales",
  "internet",
  "bdc",
  "sales manager",
];

function rankPerson(p: Person): number {
  const t = (p.title ?? "").toLowerCase();
  const i = TITLE_RANK.findIndex((k) => t.includes(k));
  return i === -1 ? TITLE_RANK.length : i;
}

export function getCallListStates(): { code: string; total: number; named: number }[] {
  return getSqlite()
    .prepare(
      `SELECT state_province AS code, COUNT(*) AS total,
              SUM(contacts LIKE '%staff-page%') AS named
       FROM dealerships WHERE state_province IS NOT NULL
       GROUP BY state_province ORDER BY named DESC, total DESC`
    )
    .all() as { code: string; total: number; named: number }[];
}

export function getCallList(state: string, limit = 200): CallListItem[] {
  const rows = getSqlite()
    .prepare(
      `SELECT d.id, d.name, d.oem, d.tier, d.city, d.state_province, d.address_street, d.postal_code,
              d.country, d.phone, d.contacts, d.tools_used, d.enrichment, d.website,
              d.website_valid, d.phone_valid, d.brand_confirmed, d.hs_in_crm, d.hs_owner,
              COALESCE(c.status,'new') AS status
       FROM dealerships d LEFT JOIN account_crm c ON c.dealership_id = d.id
       WHERE d.state_province = ?
       ORDER BY (d.contacts LIKE '%staff-page%') DESC, (d.phone IS NOT NULL) DESC, d.name
       LIMIT ?`
    )
    .all(state.toUpperCase(), limit) as (Record<string, unknown> & { contacts: string | null })[];

  const items = rows.map((r) => {
    let people: Person[] = [];
    try {
      people = (JSON.parse(r.contacts ?? "[]") as Person[]).filter((p) => p.name);
    } catch {
      people = [];
    }
    people.sort((a, b) => rankPerson(a) - rankPerson(b));
    let tools: string[] = [];
    let signals: { rating?: number; googleRating?: number; reviewCount?: number; hours?: string; closedSunday?: boolean; metaAds?: { active?: boolean; count?: number } } = {};
    try {
      tools = JSON.parse((r.tools_used as string) ?? "[]");
    } catch {}
    try {
      signals = JSON.parse((r.enrichment as string) ?? "{}");
    } catch {}
    const rating = signals.googleRating ?? signals.rating ?? null;
    const reviewCount = signals.reviewCount ?? null;
    const hasDirect = people.some((p) => p.source === "zoominfo" && p.phone);
    const fit = computePamFit({
      contacts: people,
      tools,
      // Normalize enrichment field names → what the intel engine expects (googleRating → rating).
      signals: { rating: rating ?? undefined, reviewCount: reviewCount ?? undefined, closedSunday: signals.closedSunday },
      phone: (r.phone as string) ?? null,
      phoneValid: r.phone_valid === 1,
      website: (r.website as string) ?? null,
      websiteValid: r.website_valid == null ? null : r.website_valid === 1,
      brandConfirmed: r.brand_confirmed === 1,
      tier: (r.tier as string) ?? null,
      oem: (r.oem as string) ?? null,
    });
    return {
      id: r.id as number,
      name: r.name as string,
      oem: (r.oem as string) ?? null,
      tier: (r.tier as string) ?? null,
      status: r.status as string,
      city: (r.city as string) ?? null,
      state_province: (r.state_province as string) ?? null,
      address_street: (r.address_street as string) ?? null,
      postal_code: (r.postal_code as string) ?? null,
      country: (r.country as string) ?? null,
      phone: (r.phone as string) ?? null,
      pamfit: { score: fit.score, band: fit.band, talkTrack: fit.talkTrack, opener: fit.opener, askFor: fit.askFor },
      hs_in_crm: (r.hs_in_crm as number) ?? 0,
      hs_owner: (r.hs_owner as string) ?? null,
      primary: people[0] ?? null,
      people,
      rating,
      reviewCount,
      whyNow: whyNowReasons({ rating, reviewCount, tools, people, metaAds: signals.metaAds, hasDirect }),
    };
  });

  // Hottest accounts first, reps work the list top-down.
  items.sort((a, b) => b.pamfit.score - a.pamfit.score);
  return items;
}

/* ---------- Accounts browse, chunked by work-readiness (DoorDash-calm) ---------- */

export interface BucketItem {
  id: number;
  name: string;
  oem: string | null;
  brands: string[]; // all franchise brands at this physical rooftop (CDJR etc.)
  rooftopCount: number; // how many franchise rows collapsed into this card
  city: string | null;
  state_province: string | null;
  phone: string | null;
  status: string;
  sources: number;
  trustTier: string | null;
  primaryName: string | null;
  primaryTitle: string | null;
  hsInCrm: boolean;
  hsOwner: string | null;
}

export type CrmFilter = "all" | "netnew" | "incrm";
export type QualityFilter = "trusted" | "manufacturer" | "all";

export interface Bucket {
  key: "ready" | "callable" | "research";
  total: number;
  items: BucketItem[]; // capped for render; `total` is the true count
}

/**
 * Group rooftops into the three states a rep actually works in, so a big book
 * never lands as one wall of rows:
 *   ready   , has a phone AND a named decision-maker → "call this person"
 *   callable, has a phone, no named contact yet      → "call the main line"
 *   research, no phone yet (skeleton)                → "enrich first"
 * Within each, the independently-verified (2+ source) rooftops sort first.
 */
export function getAccountBuckets(states: string[], crm: CrmFilter = "all", quality: QualityFilter = "trusted", cap = 24): { buckets: Bucket[]; total: number } {
  const db = getSqlite();
  const ph = states.map(() => "?").join(",");
  const crmWhere = crm === "netnew" ? "AND d.hs_in_crm = 0" : crm === "incrm" ? "AND d.hs_in_crm = 1" : "";
  // Quality-as-control: never show flagged noise in working views; default to multi-source-trusted.
  const qualWhere =
    quality === "trusted" ? "AND d.trust_tier IN ('platinum','gold')"
    : quality === "manufacturer" ? "AND d.brand_confirmed = 1"
    : "AND (d.trust_tier IS NULL OR d.trust_tier != 'flagged')";
  const rows = db
    .prepare(
      `SELECT d.id, d.name, d.oem, d.city, d.state_province, d.phone, d.latitude, d.longitude, d.contacts,
              COALESCE(d.confirmation_count,0) AS sources, d.trust_tier, d.hs_in_crm, d.hs_owner,
              COALESCE(c.status,'new') AS status
       FROM dealerships d LEFT JOIN account_crm c ON c.dealership_id = d.id
       WHERE d.state_province IN (${ph}) ${crmWhere} ${qualWhere}
       ORDER BY COALESCE(d.confirmation_count,0) DESC, d.name`
    )
    .all(...states.map((s) => s.toUpperCase())) as (Record<string, unknown> & { contacts: string | null })[];

  // A physical rooftop can hold several franchises (Jeep+Ram+Dodge+Chrysler = 4 rows, one
  // building the rep calls once). Collapse co-located franchises into one card, keyed by the
  // "call once" signal, the shared phone line, else geo, else the row's own id (no grouping).
  const phDigits = (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
  const tierRank = (t: string | null) => (t === "platinum" ? 3 : t === "gold" ? 2 : t === "silver" ? 1 : 0);
  const roofKey = (r: Record<string, unknown>) => {
    const d = phDigits(r.phone as string | null);
    if (d.length === 10) return `p:${d}`;
    const la = r.latitude as number | null, ln = r.longitude as number | null;
    if (la != null && ln != null) return `g:${la.toFixed(3)},${ln.toFixed(3)}`;
    return `id:${r.id}`;
  };

  const groups = new Map<string, (Record<string, unknown> & { _people: Person[] })[]>();
  for (const r of rows) {
    let people: Person[] = [];
    try {
      people = (JSON.parse((r.contacts as string) ?? "[]") as Person[]).filter((p) => p.name);
    } catch {}
    people.sort((a, b) => rankPerson(a) - rankPerson(b));
    const k = roofKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push({ ...r, _people: people });
  }

  const ready: BucketItem[] = [], callable: BucketItem[] = [], research: BucketItem[] = [];
  for (const g of groups.values()) {
    // Representative row = the one a rep would open: has a named contact, then most sources, then best tier.
    const rep = [...g].sort((a, b) => {
      const ap = a._people.length ? 1 : 0, bp = b._people.length ? 1 : 0;
      if (ap !== bp) return bp - ap;
      if ((b.sources as number) !== (a.sources as number)) return (b.sources as number) - (a.sources as number);
      return tierRank(b.trust_tier as string | null) - tierRank(a.trust_tier as string | null);
    })[0];
    const brands = [...new Set(g.map((r) => r.oem as string).filter(Boolean))].sort();
    const primary = rep._people[0] ?? null;
    const bestTier = g.reduce((best, r) => (tierRank(r.trust_tier as string | null) > tierRank(best) ? (r.trust_tier as string | null) : best), null as string | null);
    const item: BucketItem = {
      id: rep.id as number,
      name: rep.name as string,
      oem: (rep.oem as string) ?? null,
      brands,
      rooftopCount: g.length,
      city: (rep.city as string) ?? null,
      state_province: (rep.state_province as string) ?? null,
      phone: (rep.phone as string) ?? null,
      status: rep.status as string,
      sources: Math.max(...g.map((r) => (r.sources as number) ?? 0)),
      trustTier: bestTier,
      primaryName: primary?.name ?? null,
      primaryTitle: primary?.title ?? null,
      hsInCrm: g.some((r) => (r.hs_in_crm as number) === 1),
      hsOwner: (g.find((r) => r.hs_owner)?.hs_owner as string) ?? null,
    };
    if (item.phone && primary) ready.push(item);
    else if (item.phone) callable.push(item);
    else research.push(item);
  }

  const mk = (key: Bucket["key"], items: BucketItem[]): Bucket => ({ key, total: items.length, items: items.slice(0, cap) });
  return {
    buckets: [mk("ready", ready), mk("callable", callable), mk("research", research)],
    total: ready.length + callable.length + research.length,
  };
}

/* ---------- Dealer groups (sell to the group, not the rooftop) ---------- */

export interface DealerGroup {
  name: string;
  rooftops: number;
  verified: number;
  inHubspot: number;
  withContacts: number;
  brands: string[];
  states: string[];
  topRooftopId: number;
}

export function getDealerGroups(states: string[]): { groups: DealerGroup[]; groupedRooftops: number; total: number } {
  const db = getSqlite();
  const ph = states.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT id, name, oem, state_province, trust_tier, hs_in_crm, contacts
       FROM dealerships WHERE state_province IN (${ph})`
    )
    .all(...states.map((s) => s.toUpperCase())) as {
    id: number; name: string; oem: string | null; state_province: string | null; trust_tier: string | null; hs_in_crm: number; contacts: string | null;
  }[];

  const map = new Map<string, DealerGroup & { _brands: Set<string>; _states: Set<string> }>();
  let grouped = 0;
  for (const r of rows) {
    const g = detectGroup(r.name);
    if (!g) continue;
    grouped++;
    let e = map.get(g);
    if (!e) {
      e = { name: g, rooftops: 0, verified: 0, inHubspot: 0, withContacts: 0, brands: [], states: [], topRooftopId: r.id, _brands: new Set(), _states: new Set() };
      map.set(g, e);
    }
    e.rooftops++;
    if (r.trust_tier === "platinum" || r.trust_tier === "gold") e.verified++;
    if (r.hs_in_crm === 1) e.inHubspot++;
    if (r.contacts && r.contacts.includes("zoominfo")) e.withContacts++;
    if (r.oem) e._brands.add(r.oem);
    if (r.state_province) e._states.add(r.state_province);
  }
  const groups = [...map.values()]
    .map((e) => ({ ...e, brands: [...e._brands].sort(), states: [...e._states].sort() }))
    .sort((a, b) => b.rooftops - a.rooftops);
  return { groups, groupedRooftops: grouped, total: rows.length };
}

export function getAccount(id: number): FullAccount | null {
  const row = getSqlite()
    .prepare(
      `SELECT d.*, COALESCE(c.status,'new') AS status, c.owner AS owner
       FROM dealerships d LEFT JOIN account_crm c ON c.dealership_id = d.id
       WHERE d.id = ?`
    )
    .get(id) as FullAccount | undefined;
  return row ?? null;
}
