import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import {
  googleConfigured,
  exchangeCodeForProfile,
  OAUTH_STATE_COOKIE,
} from "@/lib/oauth";
import { signInWithGoogle } from "@/lib/accounts";

export const runtime = "nodejs";

function fail(req: NextRequest, reason: string) {
  const res = NextResponse.redirect(
    new URL(`/login?error=${reason}`, req.nextUrl.origin)
  );
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  if (!googleConfigured()) return fail(req, "google_unavailable");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail(req, "google_denied");

  const code = params.get("code");
  const state = params.get("state");
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // Reject anything whose state doesn't match the cookie we set at the start.
  // The cases are distinguished because they have very different causes:
  // a missing cookie is almost always a proxy or browser stripping it,
  // while a mismatch is a stale, reused, or forged link.
  if (!code) return fail(req, "no_code");
  if (!state) return fail(req, "no_state");
  if (!expected) return fail(req, "cookie_missing");
  if (state !== expected) return fail(req, "state_mismatch");

  let result;
  try {
    const profile = await exchangeCodeForProfile(code);
    result = await signInWithGoogle(getDb(), profile);
  } catch (err) {
    if (err instanceof Error && err.message === "UNVERIFIED_GOOGLE_EMAIL") {
      return fail(req, "unverified_google_email");
    }
    console.error("Google sign-in failed:", err);
    return fail(req, "google_failed");
  }

  const target = result.outcome === "created" ? "/dashboard?welcome=1" : "/dashboard";
  const res = NextResponse.redirect(new URL(target, req.nextUrl.origin));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.set(SESSION_COOKIE, await createSessionToken(result.userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
