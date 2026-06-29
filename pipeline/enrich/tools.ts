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
