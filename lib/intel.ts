// Sales intelligence synthesized from the data Dan already scraped, the rep-facing
// answer to "who do I call, why, and can I trust this?" No new fetching; pure logic
// over contacts + tech stack + signals + validation.

export interface IntelContact {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  phoneDnc?: boolean;
  mobileDnc?: boolean;
  source?: string;
}

export interface IntelInput {
  contacts: IntelContact[];
  tools: string[];
  signals: { rating?: number; reviewCount?: number; hours?: string; closedSunday?: boolean };
  phone: string | null;
  phoneValid: boolean;
  website: string | null;
  websiteValid: boolean | null;
  brandConfirmed: boolean;
}

export type ChampionKind = "comms" | "economic" | "sales";

export interface WhyCall {
  kind: "displace" | "greenfield" | "hours" | "volume" | "quality";
  label: string;
}

export interface Intel {
  champion: (IntelContact & { kind: ChampionKind; reason: string }) | null;
  whyCall: WhyCall[];
  confidence: { score: number; max: number; label: "High" | "Medium" | "Low"; signals: string[] };
}

// Pam's champion owns call handling & lead response, then the economic buyer, then sales.
const ROLE_RANK: { kind: ChampionKind; re: RegExp; reason: string }[] = [
  { kind: "comms", re: /\b(bdc|internet|e-?commerce|digital|marketing)\b/i, reason: "owns call handling & lead response" },
  { kind: "economic", re: /\b(dealer principal|general manager|owner|president|managing partner)\b/i, reason: "economic buyer" },
  { kind: "sales", re: /\b(general sales manager|sales manager|director of sales)\b/i, reason: "sales decision-maker" },
];

const CHAT_VENDORS = ["Podium", "Gubagoo", "ActivEngage", "CarNow", "LivePerson", "Intercom", "Drift"];

export function computeIntel(input: IntelInput): Intel {
  const people = input.contacts.filter((c) => c.name);

  // Champion: best-ranked role that has a named person.
  let champion: Intel["champion"] = null;
  for (const role of ROLE_RANK) {
    const hit = people.find((p) => role.re.test(p.title ?? ""));
    if (hit) {
      champion = { ...hit, kind: role.kind, reason: role.reason };
      break;
    }
  }
  if (!champion && people[0]) champion = { ...people[0], kind: "sales", reason: "primary contact" };

  // Why call, reasons derived from existing signals, sharpest-and-most-reliable FIRST.
  // Review data (rating/volume/hours) is 94% covered and verifiable; tech detection is thin,
  // so it leads only when nothing better fires (never open a call on a guess about their stack).
  const whyCall: WhyCall[] = [];
  if (input.signals.rating && input.signals.rating < 4.0) {
    whyCall.push({ kind: "quality", label: `Below-average rating (${input.signals.rating}★), reviews point to slow response and callbacks.` });
  }
  if (input.signals.closedSunday) {
    whyCall.push({ kind: "hours", label: "Closed Sundays, after-hours calls and web leads go unanswered." });
  }
  if (input.signals.reviewCount && input.signals.reviewCount >= 400) {
    whyCall.push({
      kind: "volume",
      label: `High inbound volume (~${input.signals.reviewCount.toLocaleString()} reviews), lots of calls to catch.`,
    });
  }
  const chat = CHAT_VENDORS.filter((v) => input.tools.some((t) => t.includes(v)));
  if (chat.length) {
    whyCall.push({ kind: "displace", label: `Runs ${chat.join(" + ")} for chat/text, a Pam displacement target.` });
  } else if (input.tools.length > 0) {
    whyCall.push({ kind: "greenfield", label: "No chat/messaging vendor detected, greenfield for Pam." });
  }

  // Confidence, how much of this we can stand behind.
  const sig: string[] = [];
  if (input.phone && input.phoneValid) sig.push("Phone validated");
  if (input.website && input.websiteValid) sig.push("Website live");
  if (input.brandConfirmed) sig.push("Brand confirmed (OEM)");
  if (people.length) sig.push(`${people.length} named decision-maker${people.length > 1 ? "s" : ""}`);
  if (input.signals.rating || input.signals.hours) sig.push("Public profile data");
  const score = sig.length;
  const label = score >= 4 ? "High" : score >= 2 ? "Medium" : "Low";

  return { champion, whyCall, confidence: { score, max: 5, label, signals: sig } };
}
