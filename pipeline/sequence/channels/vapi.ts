import type { ChannelAdapter, ChannelContext, ChannelResult } from "./types";
import { buildCallScript } from "../call-script";

/*
 * Real Vapi adapter — autonomous voice agent for the call step. Places an outbound call
 * through a Vapi phone number, driven by a transient assistant (or a saved assistant if
 * VAPI_ASSISTANT_ID is set). Only reached when the rep selects Vapi as their call provider
 * AND VAPI_API_KEY is set. SEQ_TEST_TO redirects to your own phone until removed.
 */

type Env = NodeJS.ProcessEnv;

export function vapiCall(env: Env): ChannelAdapter {
  return {
    kind: "call",
    async send(ctx: ChannelContext): Promise<ChannelResult> {
      const to = env.SEQ_TEST_TO || ctx.contact?.phone || ctx.dealership.phone || null;
      if (!to) return { state: "failed", provider: "vapi", error: "no destination phone" };
      if (!env.VAPI_PHONE_NUMBER_ID) return { state: "failed", provider: "vapi", error: "VAPI_PHONE_NUMBER_ID not set" };

      const body: Record<string, unknown> = {
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        customer: { number: to },
      };
      if (env.VAPI_ASSISTANT_ID) {
        body.assistantId = env.VAPI_ASSISTANT_ID;
      } else {
        body.assistant = {
          firstMessage: ctx.rendered,
          model: { provider: "openai", model: "gpt-4o", messages: [{ role: "system", content: buildCallScript(ctx) }] },
          ...(env.VAPI_VOICE ? { voice: { provider: "vapi", voiceId: env.VAPI_VOICE } } : {}),
        };
      }

      try {
        const res = await fetch("https://api.vapi.ai/call", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.VAPI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
        if (res.ok && json.id) return { state: "sent", provider: "vapi", externalRef: json.id, result: { to } };
        return { state: "failed", provider: "vapi", error: json.message ?? `HTTP ${res.status}` };
      } catch (e) {
        return { state: "failed", provider: "vapi", error: (e as Error).message };
      }
    },
  };
}
