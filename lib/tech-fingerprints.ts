/*
 * Curated, evidence-backed fingerprints for the lead-handling tech a dealership runs.
 * Each detection captures the exact marker found in the page, so a rep can verify it —
 * never a guess. Categories are chosen for one purpose: knowing what to say when selling
 * Pam (an AI sales rep). The reliably homepage-detectable signals are the website
 * platform, chat, digital-retail, trade-in, call-tracking and lead-source stack — i.e.
 * exactly how the rooftop handles inbound leads today.
 */

export type TechCategory =
  | "Website platform"
  | "Chat / messaging"
  | "Digital retail"
  | "Trade-in"
  | "Call tracking"
  | "Lead source"
  | "AI / BDC"
  | "CRM / DMS";

export interface TechVendor {
  name: string;
  category: TechCategory;
  patterns: RegExp[];
}

export const TECH_VENDORS: TechVendor[] = [
  // Website / CMS platform — who builds their site (and bundles their lead forms).
  { name: "Dealer.com", category: "Website platform", patterns: [/static\.dealer\.com/i, /\bddc-/i, /dealer\.com/i] },
  { name: "Dealer Inspire", category: "Website platform", patterns: [/dealerinspire/i, /di-cdn/i] },
  { name: "DealerOn", category: "Website platform", patterns: [/dealeron/i] },
  { name: "Dealer eProcess", category: "Website platform", patterns: [/dealereprocess/i] },
  { name: "DealerFire", category: "Website platform", patterns: [/dealerfire/i] },
  { name: "fusionZONE", category: "Website platform", patterns: [/fusionzone/i] },
  { name: "Fox Dealer", category: "Website platform", patterns: [/foxdealer/i] },
  { name: "Sincro (CDK)", category: "Website platform", patterns: [/sincrods|sincro\.|cobalt\.com/i] },
  { name: "AutoManager", category: "Website platform", patterns: [/automanager/i] },

  // Chat / messaging — Pam's closest neighbour. Most are business-hours / agent-limited.
  { name: "Podium", category: "Chat / messaging", patterns: [/widget\.podium|podium\.com/i] },
  { name: "Gubagoo", category: "Chat / messaging", patterns: [/gubagoo/i] },
  { name: "ActivEngage", category: "Chat / messaging", patterns: [/activengage/i] },
  { name: "CarNow", category: "Chat / messaging", patterns: [/carnow/i] },
  { name: "TextUs", category: "Chat / messaging", patterns: [/textus\.com/i] },
  { name: "Kenect", category: "Chat / messaging", patterns: [/kenect\.com/i] },
  { name: "LivePerson", category: "Chat / messaging", patterns: [/liveperson|lpcdn/i] },
  { name: "Intercom", category: "Chat / messaging", patterns: [/intercom\.io|intercomcdn/i] },
  { name: "Drift", category: "Chat / messaging", patterns: [/js\.driftt|drift\.com/i] },

  // AI / BDC — direct competitors. If present, it's a displacement conversation.
  { name: "Conversica", category: "AI / BDC", patterns: [/conversica/i] },
  { name: "Cyclops / Impel", category: "AI / BDC", patterns: [/impel\.ai|cyclops/i] },
  { name: "Outsell", category: "AI / BDC", patterns: [/outsell\.com/i] },

  // Digital retail — they already sell online; Pam feeds that funnel with live conversation.
  { name: "Roadster", category: "Digital retail", patterns: [/roadster\.com/i] },
  { name: "AutoFi", category: "Digital retail", patterns: [/autofi/i] },
  { name: "Darwin Automotive", category: "Digital retail", patterns: [/darwinautomotive/i] },
  { name: "TagRail", category: "Digital retail", patterns: [/tagrail/i] },
  { name: "Modal / Upstart", category: "Digital retail", patterns: [/getmodal|modal\.com/i] },

  // Trade-in / valuation
  { name: "KBB Instant Cash Offer", category: "Trade-in", patterns: [/kbb\.com|instant ?cash ?offer/i] },
  { name: "TradePending", category: "Trade-in", patterns: [/tradepending/i] },
  { name: "AccuTrade", category: "Trade-in", patterns: [/accutrade/i] },
  { name: "Edmunds", category: "Trade-in", patterns: [/edmunds\.com/i] },

  // Call tracking — they already measure calls, so answer/qualify rate is a live KPI.
  { name: "CallRail", category: "Call tracking", patterns: [/callrail/i] },
  { name: "CallSource", category: "Call tracking", patterns: [/callsource/i] },
  { name: "Marchex", category: "Call tracking", patterns: [/marchex/i] },

  // Lead sources / marketplaces — where their leads come from.
  { name: "Cars.com", category: "Lead source", patterns: [/cars\.com/i] },
  { name: "CarGurus", category: "Lead source", patterns: [/cargurus/i] },
  { name: "Autotrader", category: "Lead source", patterns: [/autotrader\.com/i] },
  { name: "TrueCar", category: "Lead source", patterns: [/truecar/i] },

  // CRM / DMS — often backend, but leak via forms/tracking when present.
  { name: "VinSolutions", category: "CRM / DMS", patterns: [/vinsolutions/i] },
  { name: "DealerSocket", category: "CRM / DMS", patterns: [/dealersocket/i] },
  { name: "Elead", category: "CRM / DMS", patterns: [/eleadcrm|elead-crm/i] },
  { name: "DriveCentric", category: "CRM / DMS", patterns: [/drivecentric/i] },
  { name: "CDK Global", category: "CRM / DMS", patterns: [/cdkglobal/i] },
  { name: "Reynolds & Reynolds", category: "CRM / DMS", patterns: [/reyrey|reynolds(and|&)?reynolds/i] },
];

export interface Detection {
  vendor: string;
  category: TechCategory;
  evidence: string; // the exact substring matched, so it can be verified
}

/** Run the fingerprints over page HTML, capturing the marker matched for each hit. */
export function detectTech(html: string): Detection[] {
  const out: Detection[] = [];
  const seen = new Set<string>();
  for (const v of TECH_VENDORS) {
    for (const p of v.patterns) {
      const m = html.match(p);
      if (m) {
        if (seen.has(v.name)) break;
        seen.add(v.name);
        out.push({ vendor: v.name, category: v.category, evidence: m[0].slice(0, 60) });
        break;
      }
    }
  }
  return out;
}

export interface PamAngle {
  angle: string;
  because: string[]; // the detections that justify it
}

/** Turn detections into a rep-ready "why Pam fits" — each angle backed by what was found. */
export function pamAngles(dets: Detection[]): PamAngle[] {
  const has = (c: TechCategory) => dets.filter((d) => d.category === c);
  const names = (c: TechCategory) => has(c).map((d) => d.vendor);
  const angles: PamAngle[] = [];

  const ai = has("AI / BDC");
  if (ai.length) {
    angles.push({
      angle: `They already run an AI/BDC tool (${names("AI / BDC").join(", ")}). This is a head-to-head displacement, so lead with answer rate and booked appointments.`,
      because: ai.map((d) => d.vendor),
    });
  }

  const chat = has("Chat / messaging");
  if (chat.length) {
    angles.push({
      angle: `They invest in web chat (${names("Chat / messaging").join(", ")}) but it's agent- and hours-limited. Pam covers after-hours and qualifies before a human picks up.`,
      because: chat.map((d) => d.vendor),
    });
  } else {
    angles.push({ angle: "No chat/messaging detected, so inbound likely falls to the front desk. Pam is the lead-capture upgrade, not a replacement.", because: [] });
  }

  const dr = has("Digital retail");
  if (dr.length) {
    angles.push({
      angle: `They sell online (${names("Digital retail").join(", ")}). Pam handles the live conversation that feeds those carts and recovers stalled deals.`,
      because: dr.map((d) => d.vendor),
    });
  }

  const call = has("Call tracking");
  if (call.length) {
    angles.push({
      angle: `They measure calls (${names("Call tracking").join(", ")}), so answer and qualification rate is already a KPI they own. Pam moves that number.`,
      because: call.map((d) => d.vendor),
    });
  }

  const crm = has("CRM / DMS");
  if (crm.length) {
    angles.push({
      angle: `CRM/DMS detected (${names("CRM / DMS").join(", ")}). Pam slots in as the AI BDC layer on top of what they already run.`,
      because: crm.map((d) => d.vendor),
    });
  }

  return angles;
}
