import type { Channel } from "../../../lib/sequence-constants";
import type { ChannelAdapter } from "./types";
import { simulatedChannel } from "./simulated";
import { twilioCall, twilioSms } from "./twilio";
import { blandCall } from "./bland";
import { giftingChannel } from "./gifting";

/**
 * Resolve the adapter for a channel.
 *
 * Routing rules (fail safe, never a surprise send):
 *  - SEQUENCE_APPLY !== "1"            → simulated (dry-run). The default.
 *  - APPLY=1 + real provider creds set → the real adapter (Twilio / gifting API).
 *  - APPLY=1 but creds missing         → simulated + a warning (so it never silently fails).
 *
 * SAFETY: with SEQ_TEST_TO set, Twilio sends are redirected to that number; with
 * SEQ_TEST_ADDRESS set, gifts are redirected to that address. Use these to prove a real
 * send against yourself before pointing the motion at a dealership.
 */
export function resolveChannel(kind: Channel, env: NodeJS.ProcessEnv = process.env): ChannelAdapter {
  if (env.SEQUENCE_APPLY !== "1") return simulatedChannel(kind);

  const twilioReady = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
  const giftReady = !!(env.GIFT_API_URL && env.GIFT_API_KEY);

  // Call: prefer Bland (live conversation) when keyed; fall back to Twilio TTS (message drop).
  if (kind === "call" && env.BLAND_API_KEY) return blandCall(env);
  if (kind === "call" && twilioReady) return twilioCall(env);
  if (kind === "sms" && twilioReady) return twilioSms(env);
  if (kind === "gift" && giftReady) return giftingChannel(env);

  console.warn(`[sequence] SEQUENCE_APPLY=1 but no real ${kind} provider configured — falling back to simulated.`);
  return simulatedChannel(kind);
}
