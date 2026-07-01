// Pam-fit scoring: synthesize every free signal Dan gathered into one 0-100 number
// so a rep works the list top-down, plus a one-line talk track. Weights are a sensible
// default ICP (greenfield/after-hours/traffic + reachability + size) and easy to tune
// once Pam's real "hot account" definition is known.

import { computeIntel, type IntelInput } from "./intel";

export interface PamFitInput extends IntelInput {
  tier: string | null;
  oem?: string | null;
}

export interface PamFit {
  score: number;
  band: "Hot" | "Warm" | "Cool";
  factors: { label: string; points: number }[];
  talkTrack: string;
  opener: string; // a drafted, Pam-shaped cold-call opener the rep can read aloud
  askFor: string; // who to ask for at the front desk
  champion: ReturnType<typeof computeIntel>["champion"];
}

// A real spoken opener that names the dealer's specific lead-leak — Pam's exact wound.
function draftOpener(kind: string | undefined, oem: string | null | undefined): string {
  const b = oem ? `${oem} ` : "";
  switch (kind) {
    case "displace":
      return `I work with ${b}dealers on where their chat/text tools drop the ball after hours — noticed you're running one and I had a quick idea worth ten minutes.`;
    case "hours":
      return `You're closed nights and Sundays, but buyers aren't — we catch the after-hours calls and web leads that go unanswered at ${b}stores. Worth a quick look?`;
    case "volume":
      return `With the volume you do, I'd bet a real chunk of calls hit voicemail after close — that's exactly the lead leak we plug for ${b}dealers.`;
    case "quality":
      return `Saw a few reviews mention slow callbacks — we make sure no lead sits waiting at ${b}stores. Could I grab ten minutes?`;
    case "greenfield":
    default:
      return `I help ${b}dealers capture the leads that slip after close — do you have anything answering calls and texts after 7pm right now?`;
  }
}

export function computePamFit(input: PamFitInput): PamFit {
  const intel = computeIntel(input);
  const kinds = new Set(intel.whyCall.map((w) => w.kind));
  const factors: { label: string; points: number }[] = [];
  const add = (label: string, points: number) => factors.push({ label, points });

  // Reachability — can the rep actually act on it today?
  if (input.phone && input.phoneValid) add("Validated phone", 15);
  if (intel.champion?.name) add(`Named champion (${intel.champion.title})`, 15);
  if (input.website && input.websiteValid) add("Live website", 5);

  // Fit / pain — does Pam solve a problem they visibly have?
  if (kinds.has("greenfield")) add("Greenfield — no chat/messaging vendor", 20);
  else if (kinds.has("displace")) add("Competitor chat installed (displace)", 15);
  if (kinds.has("hours")) add("After-hours coverage gap", 10);
  if (kinds.has("volume")) add("High call volume (busy rooftop)", 10);
  if (kinds.has("quality")) add("Reputation/response gap", 5);

  // Size / value
  if (input.tier === "A") add("Tier A — group / multi-store", 10);
  if (input.brandConfirmed) add("Brand confirmed", 5);

  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  const band = score >= 70 ? "Hot" : score >= 45 ? "Warm" : "Cool";

  // Talk track: lead with the strongest reason, end with who to ask for.
  const lead = intel.whyCall[0]?.label.replace(/\.$/, "");
  const askFor = intel.champion?.name
    ? `${intel.champion.name}${intel.champion.title ? ` (${intel.champion.title})` : ""}`
    : "the GM or whoever owns internet leads";
  const talkTrack = lead ? `${lead} — ask for ${askFor}.` : `Reach out and ask for ${askFor}.`;
  const opener = draftOpener(intel.whyCall[0]?.kind, input.oem);

  return { score, band, factors, talkTrack, opener, askFor, champion: intel.champion };
}
