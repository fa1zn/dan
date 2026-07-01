import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth gate. Every page requires a valid session cookie except the login flow and static
 * assets. Active only when APP_PASSWORD is configured (so local dev without it still runs);
 * once set, the app is closed to unauthenticated access. PII + licensed data live behind this.
 * Edge-safe: cookie carries an opaque session token (APP_SECRET), no node crypto.
 */
const sessionToken = () => process.env.APP_SECRET || process.env.APP_PASSWORD + "::session";

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next(); // gate disabled until a password is configured

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login") || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }
  if (req.cookies.get("dan_auth")?.value === sessionToken()) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
