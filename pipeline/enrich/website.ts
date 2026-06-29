import { fetchText } from "../lib/http";
import type { Contact, MasterRecord } from "../../lib/types";
import type { Enricher } from "./types";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Junk that shows up in page source but isn't a real dealer contact.
const JUNK = /(sentry|wixpress|example\.|\.png|\.jpg|\.gif|godaddy|your-?email|email@|@2x|domain\.com|sentry\.io)/i;
const ROLE_HINT = /^(sales|service|info|contact|leads|internet|fleet|parts|hello|gm|bdc)@/i;

function extractEmails(html: string, domain: string | null): string[] {
  const found = new Map<string, number>(); // email -> score
  for (const raw of html.match(EMAIL_RE) ?? []) {
    const email = raw.toLowerCase();
    if (JUNK.test(email)) continue;
    if (email.length > 60) continue;
    let score = 0;
    if (domain && email.endsWith(`@${domain}`)) score += 2; // same-domain = most credible
    if (ROLE_HINT.test(email)) score += 1;
    found.set(email, Math.max(found.get(email) ?? 0, score));
  }
  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([e]) => e)
    .slice(0, 5);
}

/**
 * Free, best-effort enricher: fetches the dealer's own homepage (cached, polite)
 * and scrapes contact emails from the markup. Many dealer sites render contacts
 * client-side or block bots, so coverage is partial — but it costs nothing and
 * adds no paid dependency. Emails are labelled with the "website" source.
 */
export const websiteContactEnricher: Enricher = {
  name: "website",
  async enrich(record: MasterRecord): Promise<Contact[]> {
    if (!record.website) return [];
    const res = await fetchText(record.website, {
      cacheNs: "enrich-website",
      timeoutMs: 12_000,
      retries: 1,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
    });
    if (!res.ok) return [];

    return extractEmails(res.text, record.domain).map<Contact>((email) => ({
      email,
      title: ROLE_HINT.test(email) ? email.split("@")[0].toUpperCase() : undefined,
      source: "website",
    }));
  },
};
