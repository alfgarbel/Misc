import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { TEMPLATES, applyBrandDefaults } from "@/lib/og/params";
import { SIZE_IDS } from "@/lib/og/sizes";
import { renderResolvedCard, resolveUrlParams } from "@/lib/urlcard/card";
import { makeRateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Previews cost no render quota — checking your own card shouldn't spend
// the month's budget — so a per-account limit is what keeps this from
// being a free rendering endpoint.
const renderLimiter = makeRateLimiter(30);

const bodySchema = z.object({
  url: z.string().min(1).max(2000),
  template: z.enum(TEMPLATES).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  accent: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .optional(),
  size: z.enum(SIZE_IDS).optional(),
});

/**
 * Renders exactly what /api/og would return for this URL, authenticated by
 * the dashboard session rather than an API key. It goes through the same
 * resolve-and-render path as the public endpoint, including the account's
 * brand defaults and its plan's watermark, so the preview is the card.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (renderLimiter.limited(user.id)) {
    return NextResponse.json(
      { error: "Too many previews. Wait a moment." },
      { status: 429 }
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a URL" }, { status: 400 });
  }

  const db = getDb();
  let params = new URLSearchParams();
  if (parsed.data.template) params.set("template", parsed.data.template);
  if (parsed.data.theme) params.set("theme", parsed.data.theme);
  if (parsed.data.accent) params.set("accent", parsed.data.accent);
  if (parsed.data.size) params.set("size", parsed.data.size);

  const resolved = await resolveUrlParams(db, params, parsed.data.url);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status });
  }
  params = applyBrandDefaults(resolved.params, {
    template: user.brandTemplate,
    theme: user.brandTheme,
    accent: user.brandAccent,
    site: user.brandSite,
  });

  const plan = await getUserPlan(db, user.id);
  const watermark = PLANS[plan].watermark;
  const rendered = await renderResolvedCard(params, {
    watermark,
    logo: watermark ? null : user.brandLogo,
    pageMeta: resolved.meta,
  });
  if (!rendered.ok) {
    return NextResponse.json({ error: rendered.message }, { status: rendered.status });
  }
  return new NextResponse(rendered.image.body, {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
