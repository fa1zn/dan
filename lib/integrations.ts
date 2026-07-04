// Catalogue of data/CRM integrations. Dan runs fully on the free tier with none of
// these connected; they're optional upgrades you wire up when you have access.

export type IntegrationStatus = "connected" | "available" | "coming-soon";

export interface Integration {
  id: string;
  name: string;
  category: string;
  tier: "Free" | "Free tier" | "Paid";
  blurb: string;
  /** Env var whose presence flips this to "connected". */
  envVar?: string;
  /** When no envVar (built-in), this fixed status is used. */
  fixedStatus?: IntegrationStatus;
  /** Show as "available" (connectable now) rather than "coming-soon" when unconnected. */
  availableNow?: boolean;
  /** Step-by-step connect instructions shown in the UI. */
  steps?: string[];
}

export const INTEGRATIONS: Integration[] = [
  {
    id: "openstreetmap",
    name: "OpenStreetMap",
    category: "Data source",
    tier: "Free",
    fixedStatus: "connected",
    blurb:
      "The rooftop backbone, every franchise dealership's name, brand, address, and coordinates, pulled from OpenStreetMap via the Overpass API. No key required.",
  },
  {
    id: "website",
    name: "Website enrichment",
    category: "Data source",
    tier: "Free",
    fixedStatus: "connected",
    blurb:
      "Pulls decision-makers (GM, GSM, sales managers), phone numbers, the dealer's tech stack, and ratings/hours straight from each rooftop's own website. No account or key required.",
  },
  {
    id: "oem-locators",
    name: "OEM dealer locators",
    category: "Data source",
    tier: "Free",
    envVar: "PROXY_URL",
    availableNow: true,
    blurb:
      "Official franchise lists for ~20 brands (GM, Stellantis, Hyundai, Kia, Nissan, Subaru, BMW, Mercedes, Lexus, Acura, Audi, Volvo…), sets brand_confirmed and pushes coverage toward ~24K. Endpoints are bot-protected, so they need a non-blocked IP.",
    steps: [
      "Get a residential/mobile proxy (Bright Data, Oxylabs, Smartproxy, IPRoyal…).",
      "Add PROXY_URL=http://user:pass@host:port to .env.",
      "Run `npm run pipeline:ingest`, the OEM adapters fire through the proxy.",
    ],
  },
  {
    id: "google-places",
    name: "Google Places",
    category: "Verification",
    tier: "Paid",
    envVar: "GOOGLE_PLACES_API_KEY",
    availableNow: true,
    blurb:
      "Independent cross-confirmation, matches each rooftop on name+geo, confirms/fills address, phone, and website, and counts as a second source so rooftops reach gold/platinum trust. ~$200/mo Google credit covers a big chunk.",
    steps: [
      "Google Cloud → enable Places API → create an API key (billing required).",
      "Add GOOGLE_PLACES_API_KEY to .env (restrict the key to Places API).",
      "Run `npm run pipeline:places` (capped/cached; dry-safe by scope).",
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "CRM",
    tier: "Free tier",
    envVar: "HUBSPOT_TOKEN",
    blurb:
      "Read-only: pull your HubSpot companies, contacts, lifecycle stage, and owners into Dan so reps can see what's already being worked and never double-prospect. Dan never writes to HubSpot.",
    steps: [
      "In HubSpot: Settings → Integrations → Private Apps → Create a private app.",
      "Grant READ scopes: crm.objects.companies.read, crm.objects.contacts.read, crm.objects.owners.read.",
      "Copy the access token into .env as HUBSPOT_TOKEN=…, then run `npm run hubspot:pull`.",
    ],
  },
  {
    id: "google-calendar",
    name: "Google Calendar + Meet",
    category: "Scheduling",
    tier: "Free tier",
    envVar: "GOOGLE_CALENDAR_TOKEN",
    availableNow: true,
    blurb:
      "Books demos onto the rep's calendar with a Google Meet link attached. Today Dan opens a pre-filled Google Calendar event when a rep taps 'Booked demo'; connect the Calendar API to auto-create the event and the Meet link, and to sync demo times back into quota tracking.",
    steps: [
      "Google Cloud → enable the Google Calendar API → create an OAuth client.",
      "Add GOOGLE_CALENDAR_TOKEN (OAuth refresh token) and GOOGLE_CALENDAR_ID to .env.",
      "Dan then auto-creates the event with a Meet link whenever a rep books a demo.",
    ],
  },
  {
    id: "zoominfo",
    name: "ZoomInfo",
    category: "Contact data",
    tier: "Paid",
    envVar: "ZOOMINFO_USERNAME",
    availableNow: true,
    blurb:
      "Direct dials and verified emails for the decision-makers Dan already found by name, so reps reach the GM's cell, not the front desk. Credit-safe: dry-run first, scoped to your top accounts.",
    steps: [
      "In ZoomInfo GTM Studio: API/MCP → REST API → Set up keys (not the MCP connectors).",
      "Add ZOOMINFO_USERNAME + ZOOMINFO_PASSWORD to .env.",
      "Dry-run cost first: `npm run zoominfo:enrich` (no credits). Then ZOOMINFO_APPLY=1 to enrich.",
    ],
  },
  {
    id: "clay",
    name: "Clay",
    category: "Enrichment",
    tier: "Paid",
    envVar: "CLAY_TOKEN",
    availableNow: true,
    blurb:
      "Waterfall enrichment across many providers from one place, fills gaps in contacts, emails, and firmographics the free website pass misses. Plugs into the same Enricher interface.",
    steps: [
      "In Clay: create a table + an HTTP API / webhook source, copy its API key.",
      "Add CLAY_TOKEN (and CLAY_WEBHOOK_URL) to .env; I'll wire the enricher to your table's fields.",
    ],
  },
];

export function statusOf(i: Integration, env: NodeJS.ProcessEnv): IntegrationStatus {
  if (i.fixedStatus) return i.fixedStatus;
  if (i.envVar && env[i.envVar]) return "connected";
  if (i.availableNow) return "available";
  return i.tier === "Paid" ? "coming-soon" : "available";
}
