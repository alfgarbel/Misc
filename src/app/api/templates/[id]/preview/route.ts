import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/usage";
import { templateSpecSchema } from "@/lib/og/spec";
import { loadSpecAssets, renderSpecImage } from "@/lib/og/render-spec";
import { makeRateLimiter } from "@/lib/ratelimit";
import { effectiveWatermark } from "@/lib/trial";

export const runtime = "nodejs";

// Previews don't count against the render quota — designing shouldn't spend
// the month's budget — so a per-account limit is what stops them being used
// as a free rendering endpoint.
const previewLimiter = makeRateLimiter(120);

const bodySchema = z.object({
  spec: templateSpecSchema,
  /** Stand-in values for {{placeholders}} while designing. */
  values: z.record(z.string().max(32), z.string().max(300)).default({}),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (previewLimiter.limited(user.id)) {
    return NextResponse.json(
      { error: "Too many previews. Wait a moment." },
      { status: 429 }
    );
  }
  // The id identifies which template is open; the spec comes from the body
  // so unsaved edits preview too.
  await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.path.join(".")}: ${issue.message}` },
      { status: 400 }
    );
  }

  const db = getDb();
  const plan = await getUserPlan(db, user.id);
  try {
    const assets = await loadSpecAssets(db, parsed.data.spec, user.id);
    const image = await renderSpecImage(parsed.data.spec, {
      watermark: effectiveWatermark(plan, user),
      values: new URLSearchParams(parsed.data.values),
      assets,
    });
    return new NextResponse(image.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Template preview failed:", err);
    return NextResponse.json({ error: "Preview failed" }, { status: 500 });
  }
}
