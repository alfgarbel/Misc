import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveApiKey } from "@/lib/keys";
import { verifySignature } from "@/lib/signing";
import { applyBrandDefaults, parseOgParams } from "@/lib/og/params";
import { renderOgImage } from "@/lib/og/render";
import { checkAndRecordRender, recordKeyRender } from "@/lib/usage";
import { maybeSendQuotaAlert } from "@/lib/alerts";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";

// Best-effort per-instance rate limit for unauthenticated (demo) renders.
const demoLimiter = makeRateLimiter(20);

function jsonError(status: number, message: string, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function GET(req: NextRequest) {
  let params = req.nextUrl.searchParams;
  const key = params.get("key");
  const acct = params.get("acct");

  // Two authenticated modes: a plain API key, or an HMAC-signed URL
  // (acct + sig) that binds the signature to the exact parameters.
  let userId: string | null = null;
  let keyId: string | null = null;
  let account: typeof users.$inferSelect | null = null;

  if (key) {
    const db = getDb();
    const resolved = await resolveApiKey(db, key);
    if (!resolved) {
      return jsonError(401, "Invalid or revoked API key");
    }
    userId = resolved.userId;
    keyId = resolved.keyId;
    account =
      (await db.query.users.findFirst({ where: eq(users.id, userId) })) ?? null;
  } else if (acct) {
    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(users.id, acct) });
    if (!user?.signingSecret || !verifySignature(params, user.signingSecret)) {
      return jsonError(401, "Invalid signature");
    }
    userId = user.id;
    account = user;
  }

  // Account defaults fill in unspecified template/theme/accent/site,
  // after signature verification (the signature covers the sent params).
  if (account) {
    params = applyBrandDefaults(params, {
      template: account.brandTemplate,
      theme: account.brandTheme,
      accent: account.brandAccent,
      site: account.brandSite,
    });
  }

  const parsed = parseOgParams(params);
  if (!parsed.success) {
    return jsonError(400, "Invalid parameters", {
      details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }

  let watermark = true;
  let cacheable = false;
  let logo: string | null = null;

  if (userId) {
    const db = getDb();
    const quota = await checkAndRecordRender(db, userId);
    await maybeSendQuotaAlert(db, userId, quota.plan, quota.used);
    if (!quota.allowed) {
      return jsonError(
        429,
        `Monthly render quota exceeded (${PLANS[quota.plan].monthlyRenders.toLocaleString()} on the ${PLANS[quota.plan].name} plan). Upgrade at /pricing.`,
        { plan: quota.plan, used: quota.used }
      );
    }
    if (keyId) await recordKeyRender(db, keyId);
    watermark = PLANS[quota.plan].watermark;
    // Custom logo is a paid-plan feature.
    if (!watermark) logo = account?.brandLogo ?? null;
    cacheable = true;
  } else {
    if (demoLimiter.limited(clientIp(req.headers))) {
      return jsonError(429, "Demo rate limit exceeded. Sign up for an API key.");
    }
  }

  try {
    const image = await renderOgImage(parsed.data, { watermark, logo });
    return new NextResponse(image.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": cacheable
          ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
          : "public, max-age=60, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("OG render failed:", err);
    return jsonError(500, "Image rendering failed");
  }
}
