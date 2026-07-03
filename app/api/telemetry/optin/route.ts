import { NextResponse } from "next/server";
import { setOptIn, getOptIn, isGloballyEnabled, NOTICE_VERSION } from "@/lib/telemetry";

/**
 * Records a rep's consent decision for ride-along logging. The client shows the disclosure
 * (exactly what is logged and why) and only calls this after the rep chooses. Storing the
 * decision server-side is what lets the ingest endpoint enforce consent and lets offboarding
 * wipe it.
 */
export async function GET(req: Request) {
  if (!isGloballyEnabled()) return NextResponse.json({ enabled: false });
  const repId = new URL(req.url).searchParams.get("repId") ?? "";
  const opt = getOptIn(repId);
  return NextResponse.json({
    enabled: true,
    noticeVersion: NOTICE_VERSION,
    decision: opt ? (opt.decision === 1 ? "in" : "out") : null,
    staleNotice: opt ? opt.notice_version !== NOTICE_VERSION : false,
  });
}

export async function POST(req: Request) {
  if (!isGloballyEnabled()) return NextResponse.json({ ok: false });
  let body: { repId?: string; decision?: boolean; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false });
  }
  if (typeof body.repId !== "string" || !body.repId) return NextResponse.json({ ok: false });
  setOptIn(body.repId, Boolean(body.decision), typeof body.label === "string" ? body.label : "");
  return NextResponse.json({ ok: true });
}
