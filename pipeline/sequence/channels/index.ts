import type { Channel } from "../../../lib/sequence-constants";
import type { ChannelAdapter } from "./types";
import { simulatedChannel } from "./simulated";
import { twilioCall, twilioSms } from "./twilio";
import { blandCall } from "./bland";
import { vapiCall } from "./vapi";
import { giftingChannel } from "./gifting";

/**
 * Resolve the adapter for a channel.
 *
 * Routing rules (fail safe, never a surprise send):
 *  - SEQUENCE_APPLY !== "1"            → simulated (dry-run). The default.
 *  - APPLY=1 + the rep's chosen/keyed provider → the real adapter.
 *  - APPLY=1 but nothing configured   → simulated + a warning.
 *
 * Call provider is the rep's choice (CALL_PROVIDER = vapi | bland | twilio), falling back
 * to whichever voice provider has credentials.
 *
 * SAFETY: SEQ_TEST_TO redirects calls/texts to your own number; SEQ_TEST_ADDRESS redirects
 * gifts. Use them to prove a real send against yourself before pointing at a dealership.
 */
export function resolveChannel(kind: Channel, env: NodeJS.ProcessEnv = process.env): ChannelAdapter {
  if (env.SEQUENCE_APPLY !== "1") return simulatedChannel(kind);

  const twilioReady = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
  const giftReady = !!(env.GIFT_API_URL && env.GIFT_API_KEY);

  if (kind === "call") {
    const voice = (p: string): ChannelAdapter | null => {
      if (p === "vapi" && env.VAPI_API_KEY) return vapiCall(env);
      if (p === "bland" && env.BLAND_API_KEY) return blandCall(env);
      if (p === "twilio" && twilioReady) return twilioCall(env);
      return null;
    };
    // The rep's selected provider first, then any keyed voice provider.
    const chosen = env.CALL_PROVIDER ?? "";
    const adapter = voice(chosen) || voice("vapi") || voice("bland") || voice("twilio");
    if (adapter) return adapter;
  }

  if (kind === "sms" && twilioReady) return twilioSms(env);
  if (kind === "gift" && giftReady) return giftingChannel(env);

  console.warn(`[sequence] SEQUENCE_APPLY=1 but no real ${kind} provider configured — falling back to simulated.`);
  return simulatedChannel(kind);
}
