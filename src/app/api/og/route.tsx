import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveApiKey } from "@/lib/keys";
import { verifySignature } from "@/lib/signing";
import { parseOgParams } from "@/lib/og/params";
import { renderOgImage } from "@/lib/og/render";
import { checkAndRecordRender } from "@/lib/usage";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";

// Best-effort per-instance rate limit for unauthenticated (demo) renders.
const DEMO_LIMIT_PER_MINUTE = 20;
const demoHits = new Map<string, { count: number; windowStart: number }>();

function demoRateLimited(ip: string, now: number = Date.now()): boolean {
  const windowMs = 60_000;
  const entry = demoHits.get(ip);
  if (!entry || now - entry.windowStart > windowMs) {
    demoHits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  if (demoHits.size > 10_000) demoHits.clear();
  return entry.count > DEMO_LIMIT_PER_MINUTE;
}

function jsonError(status: number, message: string, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const parsed = parseOgParams(params);
  if (!parsed.success) {
    return jsonError(400, "Invalid parameters", {
      details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }

  const key = params.get("key");
  const acct = params.get("acct");
  let watermark = true;
  let cacheable = false;

  // Two authenticated modes: a plain API key, or an HMAC-signed URL
  // (acct + sig) that binds the signature to the exact parameters.
  let userId: string | null = null;
  if (key) {
    userId = await resolveApiKey(getDb(), key);
    if (!userId) {
      return jsonError(401, "Invalid or revoked API key");
    }
  } else if (acct) {
    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(users.id, acct) });
    if (!user?.signingSecret || !verifySignature(params, user.signingSecret)) {
      return jsonError(401, "Invalid signature");
    }
    userId = user.id;
  }

  if (userId) {
    const db = getDb();
    const quota = await checkAndRecordRender(db, userId);
    if (!quota.allowed) {
      return jsonError(
        429,
        `Monthly render quota exceeded (${PLANS[quota.plan].monthlyRenders.toLocaleString()} on the ${PLANS[quota.plan].name} plan). Upgrade at /pricing.`,
        { plan: quota.plan, used: quota.used }
      );
    }
    watermark = PLANS[quota.plan].watermark;
    cacheable = true;
  } else {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (demoRateLimited(ip)) {
      return jsonError(429, "Demo rate limit exceeded. Sign up for an API key.");
    }
  }

  try {
    const image = await renderOgImage(parsed.data, { watermark });
    const res = new NextResponse(image.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": cacheable
          ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
          : "public, max-age=60, s-maxage=300",
      },
    });
    return res;
  } catch (err) {
    console.error("OG render failed:", err);
    return jsonError(500, "Image rendering failed");
  }
}
