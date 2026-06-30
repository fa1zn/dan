// Shared sequence vocabulary — safe to import from both client and server (no better-sqlite3 here).
// The motion layer's types, the canonical Dan sequence, and the temperature model.

export type Channel = "call" | "sms" | "gift";
export type GiftKind = "doughnuts" | "pizza" | "local";
export type EnrollmentState = "active" | "paused" | "completed" | "exited";
export type StepRunState = "pending" | "sent" | "failed" | "skipped";

export interface Delay {
  value: number;
  unit: "minutes" | "hours" | "days";
}

/**
 * How a call is conducted. Compliance-first by default:
 *  - "inquiry": a genuine, AI-disclosed, NO-SELL informational call (are you hiring? who
 *    handles it?) whose job is to earn consent for a follow-up. Lawful first touch.
 *  - "pitch": the actual sales conversation. Only appropriate AFTER consent is captured.
 */
export type CallMode = "inquiry" | "pitch";

export interface Step {
  channel: Channel;
  /** Wait this long AFTER the previous step completes before this step is due. */
  delay: Delay;
  /** Call script / SMS body / gift note. Supports {{name}} {{oem}} {{city}} {{contactFirst}} {{groupName}}. */
  template: string;
  /** For channel "call" — inquiry (default) vs pitch. */
  callMode?: CallMode;
  /** Sales touches set this: the step is BLOCKED until consent was captured on the inquiry call. */
  requiresConsent?: boolean;
  giftKind?: GiftKind; // required when channel === "gift"
  giftBudgetCents?: number; // per-gift cap; defaults to SEQ_GIFT_MAX_CENTS
}

// Activity kinds the sequence layer writes. activity.kind is unconstrained TEXT in the
// DB, so we keep our own list rather than editing lib/crm-constants.ts (zero shared edits).
export const SEQUENCE_ACTIVITY_KINDS = ["call", "sms", "gift", "sequence"] as const;
export type SequenceActivityKind = (typeof SEQUENCE_ACTIVITY_KINDS)[number];

export function activityKindFor(channel: Channel): SequenceActivityKind {
  return channel; // call → call, sms → sms, gift → gift
}

export const DAN_SEQUENCE_NAME = "Dan core motion";

// The canonical motion: compliance-first inquiry call → (consent gate) → text → edible.
// Pam opens the door with a lawful, no-sell inquiry; Dan only follows up AFTER consent.
export const DAN_SEQUENCE_STEPS: Step[] = [
  {
    channel: "call",
    callMode: "inquiry",
    delay: { value: 0, unit: "minutes" },
    template:
      "Hi, my name is Pam — I'm an AI assistant. I'm calling to ask whether {{name}} is currently hiring for sales or BDC roles, and if so, who's the best person to talk to.",
  },
  {
    channel: "sms",
    requiresConsent: true,
    delay: { value: 1, unit: "days" },
    template:
      "Hi {{contactFirst}}, this is Dan with Pam following up on our call — thanks for the OK to reach out. Worth a 10-min chat this week?",
  },
  {
    channel: "gift",
    requiresConsent: true,
    delay: { value: 2, unit: "days" },
    giftKind: "doughnuts",
    template: "Coffee & doughnuts on us for the {{name}} team — Dan @ Pam.",
  },
];

export function delayMs(d: Delay): number {
  const per = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;
  return d.value * per[d.unit];
}

// Temperature is the ENGAGEMENT axis only. Fit (pam-fit) is shown as its own axis in the
// UI — we deliberately keep them separate so a cold-but-high-fit account reads differently
// from a hot-but-low-fit one.
export type Temperature = "hot" | "warm" | "cold" | "stalled";

export function temperature(opts: {
  engaged: boolean; // replied / called back / human-marked engaged
  touches: number; // steps sent so far
  completedNoReply: boolean; // ran the whole motion, no response
}): Temperature {
  if (opts.engaged) return "hot";
  if (opts.completedNoReply) return "stalled";
  if (opts.touches > 0) return "warm";
  return "cold";
}
