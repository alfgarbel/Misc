import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getUrlMetadata } from "@/lib/urlcard";
import { makeRateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Reading a page is the expensive, outbound-facing part, so this is
// limited per account even though it costs no render quota.
const previewLimiter = makeRateLimiter(30);

const bodySchema = z.object({ url: z.string().min(1).max(2000) });

/** Resolves what a URL would put on a card, for the dashboard's try-it box. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (previewLimiter.limited(user.id)) {
    return NextResponse.json(
      { error: "Too many lookups. Wait a moment." },
      { status: 429 }
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a URL" }, { status: 400 });
  }

  const result = await getUrlMetadata(getDb(), parsed.data.url);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 422 });
  }
  return NextResponse.json({
    ok: true,
    cached: result.cached,
    meta: {
      title: result.meta.title,
      description: result.meta.description,
      siteName: result.meta.siteName,
      domain: result.meta.domain,
      hasImage: Boolean(result.meta.imageUrl),
    },
  });
}
