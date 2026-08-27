import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveApiKey } from "@/lib/keys";
import { verifySignature } from "@/lib/signing";
import { applyBrandDefaults, parseOgParams } from "@/lib/og/params";
import { renderOgImage } from "@/lib/og/render";
import { renderSpecImage, loadSpecAssets } from "@/lib/og/render-spec";
import { getTemplateBySlug, isValidSlug, specOf } from "@/lib/templates";
import { checkAndRecordRender, recordKeyRender } from "@/lib/usage";
import { maybeSendQuotaAlert } from "@/lib/alerts";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";
import { PLANS } from "@/lib/plans";
import { CACHE_VERSION_PARAM, isValidCacheVersion } from "@/lib/cachebust";
import { applyUrlMetadata, getUrlMetadata } from "@/lib/urlcard";
import type { PageMetadata } from "@/lib/urlcard";
import { loadHeroImage } from "@/lib/urlcard/image";

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

  // `v` never reaches the renderer — it exists only to change the URL, which
  // is the one thing social and CDN caches key on. It is still bounded, so a
  // caller can't mint unlimited distinct URLs for the same image.
  const version = params.get(CACHE_VERSION_PARAM);
  if (version !== null && !isValidCacheVersion(version)) {
    return jsonError(400, "Invalid parameters", {
      details: [
        `${CACHE_VERSION_PARAM}: must be 1-32 characters of A-Z, a-z, 0-9, dot, dash or underscore`,
      ],
    });
  }

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

  // ?url= reads the page and fills in what the caller didn't state. Doing
  // it after authentication matters: fetching arbitrary URLs is not
  // something an anonymous caller gets to make the server do.
  let pageMeta: PageMetadata | null = null;
  const sourceUrl = params.get("url");
  if (sourceUrl) {
    if (!userId) {
      return jsonError(401, "Rendering from a URL requires an API key or a signed URL");
    }
    const result = await getUrlMetadata(getDb(), sourceUrl);
    if (!result.ok) {
      // Explicit parameters can still carry the card on their own, so a
      // failed scrape is only fatal when nothing was supplied.
      if (!params.get("title")) {
        return jsonError(422, result.message, { url: sourceUrl });
      }
    } else {
      pageMeta = result.meta;
      params = applyUrlMetadata(params, result.meta);
    }
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

  // A custom design from the visual editor replaces the built-in templates
  // entirely: its own layers decide what the card looks like, and the other
  // parameters become {{placeholder}} values.
  const tpl = params.get("tpl");
  if (tpl) {
    if (!userId || !account) {
      return jsonError(401, "Custom templates require an API key or a signed URL");
    }
    if (!isValidSlug(tpl)) {
      return jsonError(400, "Invalid parameters", {
        details: ["tpl: must be a template slug like my-design"],
      });
    }
    const db = getDb();
    const row = await getTemplateBySlug(db, userId, tpl);
    if (!row) {
      return jsonError(404, `No template named "${tpl}" on this account`);
    }
    const spec = specOf(row);
    if (!spec.success) return jsonError(500, spec.error);

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

    try {
      const specAssets = await loadSpecAssets(db, spec.data, userId);
      const image = await renderSpecImage(spec.data, {
        watermark: PLANS[quota.plan].watermark,
        values: params,
        assets: specAssets,
      });
      return new NextResponse(image.body, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control":
            "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        },
      });
    } catch (err) {
      console.error("Custom template render failed:", err);
      return jsonError(500, "Image rendering failed");
    }
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

  // The link template is the one that shows the source page's artwork, so
  // that image is only fetched when it will actually be drawn.
  const hero =
    parsed.data.template === "link" && pageMeta
      ? await loadHeroImage(pageMeta.imageUrl)
      : null;

  try {
    const image = await renderOgImage(parsed.data, { watermark, logo, hero });
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
