import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import { runActivationEmails } from "@/lib/activation";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Without a secret the route is off, rather than open to anyone.
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily lifecycle emails. Vercel Cron calls this (see vercel.json) and sends
 * CRON_SECRET as a bearer token on its own once the variable is set.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runActivationEmails(getDb());
  return NextResponse.json({ ok: true, ...result });
}
