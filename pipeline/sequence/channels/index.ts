import type { Channel } from "../../../lib/sequence-constants";
import type { ChannelAdapter } from "./types";
import { simulatedChannel } from "./simulated";

/**
 * Resolve the adapter for a channel. Real providers (voice: twilio|vapi|bland, sms:
 * twilio, gift: doordash|ubereats) drop in here, gated on their creds AND SEQUENCE_APPLY=1.
 * Until a real adapter is wired, everything is simulated — even with APPLY set — so the
 * engine never silently fails to send and never charges by surprise.
 */
export function resolveChannel(kind: Channel, env: NodeJS.ProcessEnv = process.env): ChannelAdapter {
  // Placeholder for real-provider wiring, e.g.:
  //   if (kind === "sms" && env.SEQUENCE_APPLY === "1" && env.TWILIO_ACCOUNT_SID) return twilioSms();
  //   if (kind === "call" && env.SEQUENCE_APPLY === "1" && env.VOICE_PROVIDER) return voiceProvider(env.VOICE_PROVIDER);
  //   if (kind === "gift" && env.SEQUENCE_APPLY === "1" && env.GIFT_PROVIDER) return foodDelivery(env.GIFT_PROVIDER);
  void env;
  return simulatedChannel(kind);
}
