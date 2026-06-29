import { parsePhoneNumber } from "libphonenumber-js/core";
import phoneMetadata from "libphonenumber-js/metadata.min.json";
import { fetchText } from "../lib/http";
import type { Contact, MasterRecord } from "../../lib/types";
import type { Enricher } from "./types";

/* ---------- phones ---------- */

function formatPhone(raw: string, region: "US" | "CA"): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 10) return null;
  try {
    const p = parsePhoneNumber(digits, region, phoneMetadata as never);
    return p?.isValid() ? p.formatNational() : null;
  } catch {
    return null;
  }
}

/** Pull phone numbers from a page, preferring tel: links (the real click-to-call). */
function extractPhones(html: string, region: "US" | "CA"): string[] {
  const out = new Map<string, number>(); // formatted -> priority
  for (const m of html.matchAll(/href=["']tel:([+0-9().\-\s]{7,})["']/gi)) {
    const f = formatPhone(m[1], region);
    if (f) out.set(f, Math.max(out.get(f) ?? 0, 2));
  }
  for (const m of html.matchAll(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g)) {
    const f = formatPhone(m[0], region);
    if (f && !out.has(f)) out.set(f, 1);
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 3);
}

/* ---------- emails ---------- */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_JUNK = /(sentry|wixpress|example\.|\.png|\.jpg|\.gif|godaddy|your-?email|@2x|domain\.com)/i;
const ROLE_HINT = /^(sales|service|info|contact|leads|internet|fleet|parts|hello|gm|bdc)@/i;

function extractEmails(html: string, domain: string | null): string[] {
  const found = new Map<string, number>();
  for (const raw of html.match(EMAIL_RE) ?? []) {
    const email = raw.toLowerCase();
    if (EMAIL_JUNK.test(email) || email.length > 60) continue;
    let score = 0;
    if (domain && email.endsWith(`@${domain}`)) score += 2;
    if (ROLE_HINT.test(email)) score += 1;
    found.set(email, Math.max(found.get(email) ?? 0, score));
  }
  return [...found.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e).slice(0, 4);
}

/* ---------- people (staff pages) ---------- */

// Titles a sales rep cares about, roughly in decreasing priority.
const TITLE_RE =
  /\b(owner|dealer principal|managing partner|president|general manager|general sales manager|new (car|vehicle) (director|manager)|used (car|vehicle) (director|manager)|internet (sales )?(director|manager)|bdc (director|manager)|director of (sales|marketing)|sales manager|finance (director|manager)|f&i (director|manager)|service manager|parts manager)\b/i;

const NAME_RE = /^[A-Z][a-z'’.\-]+(?:\s+[A-Z][a-z'’.\-]+){1,2}$/;
// Reject section headers / role phrases that look like a Capitalized Name but aren't a person.
const NAV_WORDS =
  /\b(department|inventory|service|finance|parts|about|hours|directions|specials|contact|home|staff|team|meet|our|managers?|specialists?|consultants?|coordinators?|directors?|president|marketing|product|sales|certified|pre-?owned|new|used|vehicles?|center|group|buy|cars?|cash|trade|value|credit|apply|shop|view|click|call|get|welcome|hello|offers?|deals?|menu)\b/i;

function textLines(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 60);
}

const isName = (s: string) => NAME_RE.test(s) && !TITLE_RE.test(s) && !NAV_WORDS.test(s);
const titleIn = (s: string): string | null => (s.length < 45 ? s.match(TITLE_RE)?.[0] ?? null : null);

/** Staff pages list a person name immediately next to their title — pull those pairs. */
function parseStaffPeople(html: string): { name: string; title: string }[] {
  const lines = textLines(html);
  const people = new Map<string, string>();
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    let name: string | null = null;
    let title: string | null = null;
    if (isName(a) && titleIn(b)) {
      name = a;
      title = titleIn(b);
    } else if (titleIn(a) && isName(b)) {
      name = b;
      title = titleIn(a);
    }
    if (name && title && !people.has(name)) {
      people.set(name, title.replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  }
  return [...people.entries()].slice(0, 12).map(([name, title]) => ({ name, title }));
}

function findStaffUrl(html: string, base: string): string | null {
  for (const m of html.matchAll(/href=["']([^"']*(?:staff|our-team|meet-?the-?team|meet-?our-?team|employees|dealership\/staff)[^"']*)["']/gi)) {
    try {
      return new URL(m[1], base).toString();
    } catch {
      /* skip */
    }
  }
  return null;
}

async function get(url: string) {
  return fetchText(url, {
    cacheNs: "enrich-website",
    timeoutMs: 14_000,
    retries: 1,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,*/*",
    },
  });
}

/**
 * Free, best-effort enricher built for territory reps: from a dealer's own site it
 * pulls (1) the main phone to call, (2) decision-makers by name + title from the
 * staff page, and (3) any role inbox emails. No paid APIs. Coverage is partial —
 * JS-only sites and bot-walls yield nothing — and nothing is fabricated.
 */
export const websiteContactEnricher: Enricher = {
  name: "website",
  async enrich(record: MasterRecord): Promise<Contact[]> {
    if (!record.website) return [];
    const region: "US" | "CA" = record.country === "CA" ? "CA" : "US";

    const home = await get(record.website);
    if (!home.ok) return [];

    const phones = extractPhones(home.text, region);
    const mainPhone = phones[0] ?? null;
    const emails = extractEmails(home.text, record.domain);

    const contacts: Contact[] = [];

    // Decision-makers from the staff page (the people reps want to reach).
    const staffUrl = findStaffUrl(home.text, home.url);
    if (staffUrl) {
      const staff = await get(staffUrl);
      if (staff.ok) {
        for (const p of parseStaffPeople(staff.text)) {
          contacts.push({ name: p.name, title: p.title, phone: mainPhone ?? undefined, source: "staff-page" });
        }
      }
    }

    // Main line + role inbox(es) as a fallback for "call this number / email".
    if (mainPhone) contacts.push({ title: "Main line", phone: mainPhone, source: "website" });
    for (const email of emails) {
      contacts.push({ title: ROLE_HINT.test(email) ? email.split("@")[0].toUpperCase() : undefined, email, source: "website" });
    }

    return contacts;
  },
};
