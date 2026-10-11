import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCard } from "@/lib/cards";
import { getUserPlan } from "@/lib/usage";
import { applyBrandDefaults } from "@/lib/og/params";
import { renderSpecImage, loadSpecAssets } from "@/lib/og/render-spec";
import { getTemplateBySlug, isValidSlug, specOf } from "@/lib/templates";
import { renderResolvedCard, resolveUrlParams } from "@/lib/urlcard/card";
import type { PageMetadata } from "@/lib/urlcard";
import { makeRateLimiter } from "@/lib/ratelimit";
import { effectiveWatermark } from "@/lib/trial";

export const runtime = "nodejs";

// Thumbnails cost no render quota, so a per-account limit keeps the page
// list from becoming a free rendering endpoint.
const thumbLimiter = makeRateLimiter(60);

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/**
 * A card from the dashboard's page list, drawn again from the request that
 * was recorded, with the account's current brand. A page read with ?url=
 * comes from the page cache, so a thumbnail rarely reads the site again.
 */
export async function GET(
  _req: Request,
  { params: routeParams }: { params: Promise<{ key: string }> }
) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return notFound();
  if (thumbLimiter.limited(user.id)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { key } = await routeParams;
  if (!/^[0-9a-f]{32}$/.test(key)) return notFound();
  const db = getDb();
  const card = await getCard(db, user.id, key);
  if (!card) return notFound();

  let params = new URLSearchParams(card.request);
  let pageMeta: PageMetadata | null = null;
  const sourceUrl = params.get("url");
  if (sourceUrl) {
    const resolved = await resolveUrlParams(db, params, sourceUrl);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    params = resolved.params;
    pageMeta = resolved.meta;
  }
  params = applyBrandDefaults(params, {
    template: user.brandTemplate,
    theme: user.brandTheme,
    accent: user.brandAccent,
    site: user.brandSite,
  });

  const watermark = effectiveWatermark(await getUserPlan(db, user.id), user);
  const headers = { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" };

  const tpl = params.get("tpl");
  if (tpl) {
    if (!isValidSlug(tpl)) return notFound();
    const row = await getTemplateBySlug(db, user.id, tpl);
    if (!row) return notFound();
    const spec = specOf(row);
    if (!spec.success) return NextResponse.json({ error: spec.error }, { status: 422 });
    const image = await renderSpecImage(spec.data, {
      watermark,
      values: params,
      assets: await loadSpecAssets(db, spec.data, user.id),
    });
    return new NextResponse(image.body, { status: 200, headers });
  }

  const rendered = await renderResolvedCard(params, {
    watermark,
    logo: watermark ? null : user.brandLogo,
    pageMeta,
  });
  if (!rendered.ok) {
    return NextResponse.json({ error: rendered.message }, { status: rendered.status });
  }
  return new NextResponse(rendered.image.body, { status: 200, headers });
}
