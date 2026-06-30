import type { ChannelAdapter, ChannelContext, ChannelResult } from "./types";

/*
 * Real edible adapter — the most autonomous path: a gifting-platform API (Postal /
 * Sendoso / Reachdesk-style) that places a programmatic send to the rooftop's address.
 * Provider-neutral on purpose: it POSTs to GIFT_API_URL with a bearer key. The exact
 * request/response field names differ per provider — map them here once you pick one
 * (the marked lines are the only provider-specific bits).
 *
 * Only reached when SEQUENCE_APPLY=1 AND GIFT_API_URL + GIFT_API_KEY are set.
 */

export function giftingChannel(env: NodeJS.ProcessEnv): ChannelAdapter {
  return {
    kind: "gift",
    async send(ctx: ChannelContext): Promise<ChannelResult> {
      const d = ctx.dealership;
      const realAddress = [d.address_street, d.city, d.state_province, d.postal_code].filter(Boolean).join(", ");
      const address = env.SEQ_TEST_ADDRESS || realAddress;
      if (!address) return { state: "failed", provider: "gifting", error: "no delivery address" };

      try {
        const res = await fetch(env.GIFT_API_URL!, {
          method: "POST",
          headers: { Authorization: `Bearer ${env.GIFT_API_KEY}`, "Content-Type": "application/json" },
          // --- provider-specific payload: map to Postal/Sendoso/Reachdesk fields ---
          body: JSON.stringify({
            recipient: { name: d.name, address },
            item: ctx.step.giftKind ?? "doughnuts",
            note: ctx.rendered,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          id?: string;
          order_id?: string;
          cost_cents?: number;
          message?: string;
        };
        if (res.ok) {
          return {
            state: "sent",
            provider: "gifting",
            externalRef: json.id ?? json.order_id, // --- provider-specific id field ---
            costCents: json.cost_cents,
            result: { address },
          };
        }
        return { state: "failed", provider: "gifting", error: json.message ?? `HTTP ${res.status}` };
      } catch (e) {
        return { state: "failed", provider: "gifting", error: (e as Error).message };
      }
    },
  };
}
