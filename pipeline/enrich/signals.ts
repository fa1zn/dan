// Extra free, high-value signals scraped from a dealer homepage: Google rating +
// review count, opening hours, and social profiles. Most dealer sites embed all of
// this as schema.org JSON-LD, so one parse yields structured data; we also sweep raw
// links as a fallback. Plus an email-pattern guess so a rep can reach anyone on staff.

export interface Signals {
  rating?: number;
  reviewCount?: number;
  hours?: string;
  socials?: Record<string, string>;
  emailPattern?: string;
}

const SOCIAL_HOSTS: { key: string; re: RegExp }[] = [
  { key: "facebook", re: /facebook\.com\/[A-Za-z0-9.\-_/]+/i },
  { key: "instagram", re: /instagram\.com\/[A-Za-z0-9.\-_/]+/i },
  { key: "linkedin", re: /linkedin\.com\/(company|in)\/[A-Za-z0-9.\-_/]+/i },
  { key: "youtube", re: /youtube\.com\/(channel|user|c|@)[A-Za-z0-9.\-_/]+/i },
  { key: "twitter", re: /(twitter\.com|x\.com)\/[A-Za-z0-9.\-_/]+/i },
  { key: "tiktok", re: /tiktok\.com\/@[A-Za-z0-9.\-_/]+/i },
];

function walkJsonLd(node: unknown, out: Record<string, unknown>[]) {
  if (Array.isArray(node)) {
    for (const n of node) walkJsonLd(n, out);
  } else if (node && typeof node === "object") {
    out.push(node as Record<string, unknown>);
    const graph = (node as { "@graph"?: unknown })["@graph"];
    if (graph) walkJsonLd(graph, out);
  }
}

function parseJsonLd(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walkJsonLd(JSON.parse(m[1].trim()), nodes);
    } catch {
      // malformed JSON-LD block — skip
    }
  }
  return nodes;
}

function formatHours(spec: unknown): string | undefined {
  if (typeof spec === "string") return spec;
  if (Array.isArray(spec)) {
    const parts = spec
      .map((s) => {
        if (typeof s === "string") return s;
        const o = s as { dayOfWeek?: unknown; opens?: string; closes?: string };
        const days = Array.isArray(o.dayOfWeek)
          ? o.dayOfWeek.map((d) => String(d).replace(/.*\//, "").slice(0, 3)).join(",")
          : String(o.dayOfWeek ?? "").replace(/.*\//, "").slice(0, 3);
        return o.opens ? `${days} ${o.opens}-${o.closes}` : "";
      })
      .filter(Boolean);
    return parts.length ? parts.slice(0, 7).join("; ") : undefined;
  }
  return undefined;
}

/** Infer an email pattern (e.g. "{f}{last}@domain") from a same-domain personal email. */
function inferEmailPattern(emails: string[], people: { name?: string }[], domain: string | null): string | undefined {
  if (!domain) return undefined;
  for (const email of emails) {
    const [local, host] = email.toLowerCase().split("@");
    if (host !== domain) continue;
    for (const p of people) {
      const parts = (p.name ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      if (parts.length < 2) continue;
      const first = parts[0];
      const last = parts[parts.length - 1];
      if (local === `${first}.${last}`) return `{first}.{last}@${domain}`;
      if (local === `${first}${last}`) return `{first}{last}@${domain}`;
      if (local === `${first[0]}${last}`) return `{f}{last}@${domain}`;
      if (local === `${first}${last[0]}`) return `{first}{l}@${domain}`;
      if (local === first) return `{first}@${domain}`;
    }
  }
  return undefined;
}

export function extractSignals(
  html: string,
  domain: string | null,
  emails: string[] = [],
  people: { name?: string }[] = []
): Signals {
  const sig: Signals = {};
  const nodes = parseJsonLd(html);

  for (const n of nodes) {
    const agg = n.aggregateRating as { ratingValue?: string; reviewCount?: string; ratingCount?: string } | undefined;
    if (agg && sig.rating == null) {
      const r = Number(agg.ratingValue);
      if (Number.isFinite(r) && r > 0 && r <= 5) {
        sig.rating = Math.round(r * 10) / 10;
        sig.reviewCount = Number(agg.reviewCount ?? agg.ratingCount) || undefined;
      }
    }
    if (!sig.hours) sig.hours = formatHours(n.openingHoursSpecification ?? n.openingHours);
    const sameAs = n.sameAs;
    if (Array.isArray(sameAs)) {
      const socials = sig.socials ?? {};
      for (const url of sameAs) {
        for (const s of SOCIAL_HOSTS) if (s.re.test(String(url)) && !socials[s.key]) socials[s.key] = String(url);
      }
      if (Object.keys(socials).length) sig.socials = socials;
    }
  }

  // Fallback: sweep raw links for socials not in JSON-LD.
  const socials = sig.socials ?? {};
  for (const s of SOCIAL_HOSTS) {
    if (socials[s.key]) continue;
    const m = html.match(s.re);
    if (m) socials[s.key] = m[0].startsWith("http") ? m[0] : `https://${m[0]}`;
  }
  if (Object.keys(socials).length) sig.socials = socials;

  const pattern = inferEmailPattern(emails, people, domain);
  if (pattern) sig.emailPattern = pattern;

  return sig;
}
