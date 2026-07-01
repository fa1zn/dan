// Detect a dealership's technology stack from its homepage HTML. These are real
// competitive-intel signals for a sales rep: the website platform, chat/messaging
// vendor, digital-retail tooling, trade-in widgets, and tracking — i.e. what the
// rooftop already uses (and what an AI sales agent would sit alongside or replace).

interface Signature {
  tool: string;
  category: string;
  patterns: RegExp[];
}

const SIGNATURES: Signature[] = [
  // Website / CMS platform
  { tool: "Dealer.com", category: "Website", patterns: [/dealer\.com/i, /static\.dealer\.com/i, /\bddc-/i] },
  { tool: "Dealer Inspire", category: "Website", patterns: [/dealerinspire/i, /di-cdn/i] },
  { tool: "DealerOn", category: "Website", patterns: [/dealeron/i] },
  { tool: "Dealer eProcess", category: "Website", patterns: [/dealereprocess/i] },
  { tool: "DealerFire", category: "Website", patterns: [/dealerfire/i] },
  { tool: "fusionZONE", category: "Website", patterns: [/fusionzone/i] },
  { tool: "Fox Dealer", category: "Website", patterns: [/foxdealer/i] },
  { tool: "Sincro / CDK", category: "Website", patterns: [/sincrods|sincro\.|cobalt\.com/i] },
  { tool: "AutoManager", category: "Website", patterns: [/automanager/i] },

  // Chat / messaging
  { tool: "Podium", category: "Chat", patterns: [/podium\.com|widget\.podium/i] },
  { tool: "Gubagoo", category: "Chat", patterns: [/gubagoo/i] },
  { tool: "ActivEngage", category: "Chat", patterns: [/activengage/i] },
  { tool: "CarNow", category: "Chat", patterns: [/carnow/i] },
  { tool: "LivePerson", category: "Chat", patterns: [/liveperson|lpcdn/i] },
  { tool: "Intercom", category: "Chat", patterns: [/intercom\.io|intercomcdn/i] },
  { tool: "Drift", category: "Chat", patterns: [/drift\.com|js\.driftt/i] },

  // Digital retail / financing
  { tool: "Roadster", category: "Digital retail", patterns: [/roadster\.com/i] },
  { tool: "AutoFi", category: "Digital retail", patterns: [/autofi/i] },
  { tool: "Darwin Automotive", category: "Digital retail", patterns: [/darwinautomotive/i] },
  { tool: "TagRail", category: "Digital retail", patterns: [/tagrail/i] },
  { tool: "DealerPolicy", category: "Insurance", patterns: [/dealerpolicy/i] },

  // Trade-in / valuation
  { tool: "KBB ICO", category: "Trade-in", patterns: [/kbb\.com|kelley ?blue ?book|instant cash offer/i] },
  { tool: "TradePending", category: "Trade-in", patterns: [/tradepending/i] },
  { tool: "Edmunds", category: "Trade-in", patterns: [/edmunds\.com/i] },
  { tool: "TrueCar", category: "Marketplace", patterns: [/truecar/i] },

  // CRM (often leaks via forms/tracking)
  { tool: "VinSolutions", category: "CRM", patterns: [/vinsolutions/i] },
  { tool: "DealerSocket", category: "CRM", patterns: [/dealersocket/i] },
  { tool: "Elead CRM", category: "CRM", patterns: [/eleadcrm|elead-crm/i] },

  // Tracking / analytics
  { tool: "Google Tag Manager", category: "Analytics", patterns: [/googletagmanager\.com/i] },
  { tool: "Google Analytics", category: "Analytics", patterns: [/google-analytics\.com|gtag\/js/i] },
  { tool: "Meta Pixel", category: "Analytics", patterns: [/connect\.facebook\.net/i] },
  { tool: "CallRail", category: "Call tracking", patterns: [/callrail/i] },
  { tool: "DealerView / Foureyes", category: "Analytics", patterns: [/foureyes/i] },
];

/** Return the detected tools as "Category: Tool" strings (deduped, stable order). */
export function detectTools(html: string): string[] {
  const out: string[] = [];
  for (const sig of SIGNATURES) {
    if (sig.patterns.some((p) => p.test(html))) out.push(`${sig.category}: ${sig.tool}`);
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * DMS / CRM fingerprinting.
 *
 * The dealer's back-office DMS (CDK, Reynolds, Tekion, Dealertrack, Auto/Mate) and
 * front-office CRM / website platform (DealerSocket, VinSolutions, Elead, Dealer.com,
 * DealerOn, Dealer Inspire, Sincro) are the systems an AI sales agent must integrate
 * with or displace — the single highest-value tech signal for the sales conversation.
 *
 * We infer them from markers that leak into the public homepage: script src hosts,
 * asset CDNs, tracking beacons, form endpoints, and integration snippets. This is a
 * best-effort read of the CLIENT side only — the DMS in particular is a back-office
 * system that frequently leaves NO homepage trace, so absence is not evidence of
 * absence. Each detection carries the literal matched string as evidence.
 * --------------------------------------------------------------------------- */

interface VendorSig {
  vendor: string;
  /** Ordered most-specific first; the first hit's matched text becomes the evidence. */
  patterns: RegExp[];
}

// DMS = Dealer Management System (back-office: inventory, F&I, accounting, service).
// NOTE: DMS names leak into the homepage far less than CRMs, and when they do it's often
// a widget class name, not the real back-office system. Patterns are restricted to host /
// script / asset markers (e.g. `dealertrack.com`) and NOT bare product words, because a
// plain /dealertrack/ hit is usually a Dealer.com payment-calculator CSS class
// (".calculator-payment-dealertrack-conditional-incentives"), not the dealer's DMS.
const DMS_SIGS: VendorSig[] = [
  { vendor: "CDK Global", patterns: [/cdk\.com/i, /cdkglobal/i, /fortellis/i, /\bcdkdealer/i] },
  { vendor: "Reynolds & Reynolds", patterns: [/reyrey\.com/i, /reynoldsandreynolds/i] },
  { vendor: "Dealertrack", patterns: [/dealertrack\.com/i, /dealertrack\.net/i, /dtdms/i] },
  { vendor: "Tekion", patterns: [/tekion\.com/i] },
  { vendor: "Auto/Mate", patterns: [/automate\.net/i, /auto-mate\.com/i] },
];

// CRM / website platform (front-office: lead capture, marketing, the site itself).
const CRM_SIGS: VendorSig[] = [
  { vendor: "VinSolutions", patterns: [/vinsolutions\.com/i, /vinsolutions/i] },
  { vendor: "DealerSocket", patterns: [/dealersocket/i] },
  { vendor: "Elead CRM", patterns: [/eleadcrm/i, /elead-?crm/i, /\belead\b/i] },
  { vendor: "Dealer.com", patterns: [/static\.dealer\.com/i, /\bdealer\.com\b/i, /\bddc-/i] },
  { vendor: "DealerOn", patterns: [/dealeron\.com/i, /dealeron/i] },
  { vendor: "Dealer Inspire", patterns: [/dealerinspire/i, /di-cdn/i, /\bdi-uploads\b/i] },
  { vendor: "Sincro", patterns: [/sincrods/i, /sincro\.com/i, /cobalt\.com/i] },
];

export interface VendorDetection {
  vendor: string | null;
  evidence: string | null;
}

function firstVendor(html: string, sigs: VendorSig[]): VendorDetection {
  for (const sig of sigs) {
    for (const p of sig.patterns) {
      const m = html.match(p);
      if (m) return { vendor: sig.vendor, evidence: m[0] };
    }
  }
  return { vendor: null, evidence: null };
}

/** Detect the dealer's DMS vendor from homepage HTML (best-effort; often absent). */
export function detectDms(html: string): VendorDetection {
  return firstVendor(html, DMS_SIGS);
}

/** Detect the dealer's CRM / website-platform vendor from homepage HTML. */
export function detectCrm(html: string): VendorDetection {
  return firstVendor(html, CRM_SIGS);
}
