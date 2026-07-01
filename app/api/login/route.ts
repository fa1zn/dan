import { NextResponse } from "next/server";

/** Auth gate — verifies the shared password and sets an httpOnly session cookie.
 *  Internal-tool grade: a single team password from env. (Production would move to
 *  per-user SSO + real sessions; this closes the "wide-open app" hole now.) */
export async function POST(req: Request) {
  const password = process.env.APP_PASSWORD || "";
  const form = await req.formData();
  const submitted = String(form.get("password") ?? "");
  if (!password || submitted !== password) {
    return NextResponse.redirect(new URL("/login?e=1", req.url), 303);
  }
  const token = process.env.APP_SECRET || password + "::session";
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set("dan_auth", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return res;
}
