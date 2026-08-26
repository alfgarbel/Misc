import { NextRequest, NextResponse } from "next/server";
import {
  googleConfigured,
  googleAuthUrl,
  generateState,
  OAUTH_STATE_COOKIE,
} from "@/lib/oauth";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const limiter = makeRateLimiter(20);

/** Starts the Google sign-in flow. */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=google_unavailable", req.nextUrl.origin)
    );
  }
  if (limiter.limited(clientIp(req.headers))) {
    return NextResponse.redirect(
      new URL("/login?error=rate_limited", req.nextUrl.origin)
    );
  }

  // The state is echoed back by Google and compared against this cookie,
  // which is what stops a third party from forging the callback.
  const state = generateState();
  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
