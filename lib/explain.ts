// Plain-language explanations surfaced via info tooltips across the UI.

export const EXPLAIN = {
  tier:
    "How accounts are ranked. Tier A = a priority account: it belongs to a known dealer group OR shares a website domain with other rooftops (group_size > 1). Tier B = a standalone single rooftop. It's a heuristic to help reps work the bigger groups first.",
  tierA:
    "Tier A accounts belong to a known dealer group or share a domain with other rooftops (multi-store). Everything else is Tier B.",
  websiteValid:
    "Of the rooftops whose website we checked, the share that returned a live 2xx page on the dealer's own domain (not a social/aggregator page).",
  phoneValid:
    "Of rooftops that have a phone number, the share that pass libphonenumber validation as a real US/CA number.",
  brandConfirmed:
    "TRUE only when the rooftop came from an official OEM dealer locator. OSM-sourced rooftops carry a brand tag but aren't OEM-confirmed, so this reads 0% until the OEM adapters run from a non-blocked network.",
  status:
    "Where the account sits in Dan's pipeline: New → Working → Engaged → Won/Lost. Set it on the rooftop page; changes are logged to the activity timeline.",
  tools:
    "Technology detected on the dealer's own website — platform, chat/messaging, digital-retail, trade-in and tracking vendors. Useful competitive intel for what an AI sales agent would sit alongside or replace.",
  primaryContact:
    "The decision-maker to call first, scraped from the dealer's staff page and ranked by role (GM → owner → GSM → sales manager …).",
} as const;

export type ExplainKey = keyof typeof EXPLAIN;
