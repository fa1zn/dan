import { NextResponse } from "next/server";
import { exchangeCodeAndConnect, syncCalendar, type CalProvider } from "@/lib/calendar";

/**
 * OAuth callback: the provider redirects here with a `code`. We exchange it for tokens (stored
 * encrypted), pull today's events, and send the rep back to Territory. On any failure we return
 * to Territory with an honest error flag rather than a dead end.
 */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const base = process.env.APP_BASE_URL || url.origin;
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code || (provider !== "google" && provider !== "outlook")) {
    return NextResponse.redirect(`${base}/territory?calendar=error`);
  }

  try {
    await exchangeCodeAndConnect(provider as CalProvider, code, `${base}/api/calendar/callback/${provider}`);
    await syncCalendar();
    return NextResponse.redirect(`${base}/territory?calendar=connected`);
  } catch {
    return NextResponse.redirect(`${base}/territory?calendar=error`);
  }
}
