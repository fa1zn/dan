import { NextResponse } from "next/server";

/**
 * Starts the real OAuth flow to connect a rep's calendar. It redirects to Google's or
 * Microsoft's consent screen when a client id is configured; if none is set yet, it sends the
 * rep back to Territory with a setup note. It never fakes a connection or invents events.
 *
 * The token exchange + event sync callback is the remaining piece and is wired once creds exist.
 */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const base = process.env.APP_BASE_URL || new URL(req.url).origin;

  if (provider === "google") {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    if (!clientId) return NextResponse.redirect(`${base}/territory?calendar=setup&provider=google`);
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", `${base}/api/calendar/callback/google`);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.readonly");
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    return NextResponse.redirect(u.toString());
  }

  if (provider === "outlook") {
    const clientId = process.env.MS_CALENDAR_CLIENT_ID;
    if (!clientId) return NextResponse.redirect(`${base}/territory?calendar=setup&provider=outlook`);
    const u = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", `${base}/api/calendar/callback/outlook`);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "Calendars.Read offline_access");
    u.searchParams.set("response_mode", "query");
    return NextResponse.redirect(u.toString());
  }

  return NextResponse.redirect(`${base}/territory`);
}
