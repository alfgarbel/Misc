import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { coerceUrl } from "@/lib/checker";
import { detectBrand } from "@/lib/brand-detect";
import { makeRateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Each call reads someone's site and its icon.
const detectLimiter = makeRateLimiter(10);

const bodySchema = z.object({ url: z.string().min(1).max(2000) });

/**
 * Suggests brand defaults from a site's own name, theme colour and icon.
 * Nothing is saved: the dashboard fills the form and the person decides.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (detectLimiter.limited(user.id)) {
    return NextResponse.json({ error: "Too many tries. Wait a minute." }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  const url = parsed.success ? coerceUrl(parsed.data.url) : null;
  if (!url) {
    return NextResponse.json({ error: "Enter a web address" }, { status: 400 });
  }
  const detected = await detectBrand(url).catch(() => null);
  if (!detected) {
    return NextResponse.json({ error: "We couldn't read that site." }, { status: 422 });
  }
  return NextResponse.json(detected);
}
