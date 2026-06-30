import type { ChannelAdapter, ChannelContext, ChannelResult } from "./types";

/*
 * Real Twilio adapters — SMS + voice. Hits Twilio's REST API directly (no SDK dep).
 * Only ever reached when SEQUENCE_APPLY=1 AND creds are present (see channels/index.ts),
 * so importing this file never sends anything on its own.
 *
 * SAFETY: if SEQ_TEST_TO is set, every call/text is redirected to that number regardless
 * of the dealership — so the first real send goes to your own phone, not a rooftop.
 */

type Env = NodeJS.ProcessEnv;

async function twilioPost(env: Env, resource: string, form: Record<string, string>) {
  const sid = env.TWILIO_ACCOUNT_SID!;
  const token = env.TWILIO_AUTH_TOKEN!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/${resource}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  return { ok: res.ok, status: res.status, json };
}

function destination(ctx: ChannelContext, env: Env): string | null {
  // Test override wins so we never hit a real rooftop before you've proven it on your phone.
  return env.SEQ_TEST_TO || ctx.contact?.phone || ctx.dealership.phone || null;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

export function twilioSms(env: Env): ChannelAdapter {
  return {
    kind: "sms",
    async send(ctx): Promise<ChannelResult> {
      const to = destination(ctx, env);
      if (!to) return { state: "failed", provider: "twilio", error: "no destination phone" };
      try {
        const { ok, status, json } = await twilioPost(env, "Messages.json", {
          To: to,
          From: env.TWILIO_FROM!,
          Body: ctx.rendered,
        });
        if (ok) return { state: "sent", provider: "twilio", externalRef: json.sid, result: { to } };
        return { state: "failed", provider: "twilio", error: json.message ?? `HTTP ${status}` };
      } catch (e) {
        return { state: "failed", provider: "twilio", error: (e as Error).message };
      }
    },
  };
}

export function twilioCall(env: Env): ChannelAdapter {
  return {
    kind: "call",
    async send(ctx): Promise<ChannelResult> {
      const to = destination(ctx, env);
      if (!to) return { state: "failed", provider: "twilio", error: "no destination phone" };
      const twiml = `<Response><Say voice="Polly.Matthew">${escapeXml(ctx.rendered)}</Say></Response>`;
      try {
        const { ok, status, json } = await twilioPost(env, "Calls.json", {
          To: to,
          From: env.TWILIO_FROM!,
          Twiml: twiml,
        });
        if (ok) return { state: "sent", provider: "twilio", externalRef: json.sid, result: { to } };
        return { state: "failed", provider: "twilio", error: json.message ?? `HTTP ${status}` };
      } catch (e) {
        return { state: "failed", provider: "twilio", error: (e as Error).message };
      }
    },
  };
}
