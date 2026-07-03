import type { ChannelContext } from "./channels/types";

/*
 * Voice-agent call scripts. Two modes, compliance-first:
 *
 *  - inquiry (default): a genuine, AI-disclosed, NO-SELL informational call. Its only job is
 *    to find out who handles hiring and to EARN CONSENT for a follow-up. It must not pitch,
 *    name a product, or mention price — the moment it does, it's telemarketing.
 *  - pitch: the actual sales conversation, only used after consent was captured.
 *
 * This is the difference between a lawful permission-first first touch and a disguised
 * solicitation. Keep the inquiry script clean.
 */

export function buildInquiryTask(ctx: ChannelContext): string {
  const d = ctx.dealership;
  const where = d.city ? ` in ${d.city}` : "";
  const contact = d.contacts?.[0];
  return [
    `You are Pam, an AI voice assistant placing a brief, polite call to ${d.name}${where}${d.oem ? `, a ${d.oem} dealership` : ""}.`,
    d.group_name ? `It's part of the ${d.group_name} group.` : "",
    "FIRST, disclose that you are an AI assistant. Be warm, brief, and natural — and use the dealership's name so it's clearly a call for them specifically, not a generic robocall.",
    "PURPOSE (the only purpose): find out whether they are currently hiring for sales / BDC / internet-sales roles, and who the right person to speak with about that is.",
    contact?.name
      ? `You have a possible contact on file: ${contact.name}${contact.title ? `, ${contact.title}` : ""}. You may ask whether that's the right person for hiring — but do not assume; let them direct you.`
      : "",
    "HARD RULES — do not break these: do NOT sell, pitch, promote, or recommend anything. Do NOT mention any product, service, pricing, or offer. Do NOT try to book a sales meeting. This is purely an inquiry.",
    "Flow: (1) Greet using the dealership's name and disclose you're an AI. (2) Ask: are you currently hiring for sales or BDC roles? (3) If yes or maybe, ask who the best person to talk to about that is — get their name and title. (4) Ask permission: would it be okay for someone to follow up with them? (5) Thank them and end.",
    "If they are not interested, ask you to stop, or seem annoyed: apologize briefly and end the call immediately.",
    "At the end, clearly state for the record: whether they are hiring, the name and role of who to talk to, and whether they consented to a follow-up.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildPitchTask(ctx: ChannelContext): string {
  const d = ctx.dealership;
  const who = [d.oem ? `a ${d.oem} store` : null, d.city ? `in ${d.city}` : null].filter(Boolean).join(" ");
  return [
    "You are Dan, a friendly, concise sales rep for Pam — an AI sales platform for car dealerships.",
    `You're following up with ${d.name}${who ? ` (${who})` : ""}, who agreed to a follow-up.`,
    `Open with: "${ctx.rendered}"`,
    "Goal: briefly introduce Pam, gauge interest, and book a 10-minute follow-up with the right person.",
    "Keep it under two minutes, sound natural, answer questions, and if they're not interested thank them and end politely.",
  ].join(" ");
}

/** Pick the script for this call step. Inquiry is the default (compliance-first). */
export function buildCallScript(ctx: ChannelContext): string {
  return ctx.step.callMode === "pitch" ? buildPitchTask(ctx) : buildInquiryTask(ctx);
}
