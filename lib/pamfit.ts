// Pam-fit scoring: synthesize every free signal Dan gathered into one 0-100 number
// so a rep works the list top-down, plus a one-line talk track. Weights are a sensible
// default ICP (greenfield/after-hours/traffic + reachability + size) and easy to tune
// once Pam's real "hot account" definition is known.

import { computeIntel, type IntelInput } from "./intel";

export interface PamFitInput extends IntelInput {
  tier: string | null;
}

export interface PamFit {
  score: number;
  band: "Hot" | "Warm" | "Cool";
  factors: { label: string; points: number }[];
  talkTrack: string;
  champion: ReturnType<typeof computeIntel>["champion"];
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
  if (kinds.has("greenfield")) add("Greenfield, no chat/messaging vendor", 20);
  else if (kinds.has("displace")) add("Competitor chat installed (displace)", 15);
  if (kinds.has("hours")) add("After-hours coverage gap", 10);
  if (kinds.has("volume")) add("High call volume (busy rooftop)", 10);
  if (kinds.has("quality")) add("Reputation/response gap", 5);

  // Size / value
  if (input.tier === "A") add("Tier A, group / multi-store", 10);
  if (input.brandConfirmed) add("Brand confirmed", 5);

  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  const band = score >= 70 ? "Hot" : score >= 45 ? "Warm" : "Cool";

  // Talk track: lead with the strongest reason, end with who to ask for.
  const lead = intel.whyCall[0]?.label.replace(/\.$/, "");
  const who = intel.champion?.name
    ? `ask for ${intel.champion.name}${intel.champion.title ? ` (${intel.champion.title})` : ""}`
    : "ask for the GM";
  const whoCap = who.charAt(0).toUpperCase() + who.slice(1);
  const talkTrack = lead ? `${lead}. ${whoCap}.` : `Reach out and ${who}.`;

  return { score, band, factors, talkTrack, champion: intel.champion };
}
