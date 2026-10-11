import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { coerceUrl } from "@/lib/checker";
import { fetchFailureMessage } from "@/lib/checker/report";
import { fetchHtml } from "@/lib/urlcard/fetch";
import { extractCardTags } from "@/lib/urlcard/extract";
import { classifyOgImage, saveOnboardingUrl } from "@/lib/onboarding";
import { markLive } from "@/lib/funnel";
import { makeRateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Each check reads someone's server; this is a person clicking a button.
const limiter = makeRateLimiter(10);

const bodySchema = z.object({ url: z.string().min(1).max(2000) });

const MESSAGES = {
  live: "Your card is live. Every share of this page now shows it.",
  no_image:
    "This page has no og:image tag yet. Paste the tag above into its <head>, deploy, and check again.",
  not_ogsmith:
    "This page has an og:image, but it isn't an OGsmith card. Replace it with the tag above.",
  other_account:
    "This page uses an OGsmith card, but not with one of your active keys. Check the key in the tag.",
} as const;

/** Reads a page and says whether its og:image is this account's card. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (limiter.limited(user.id)) {
    return NextResponse.json(
      { error: "That's a lot of checks in a minute. Give it a moment." },
      { status: 429 }
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  const url = parsed.success ? coerceUrl(parsed.data.url) : null;
  if (!url) {
    return NextResponse.json({ error: "Enter a web address" }, { status: 400 });
  }

  const db = getDb();
  await saveOnboardingUrl(db, user.id, url, { overwrite: true });

  // A direct read rather than the checker's report: the checker caches for
  // five minutes, and someone pressing this has usually just deployed. Only
  // the tags matter here, so the image itself isn't fetched either.
  const res = await fetchHtml(url);
  if (!res.ok) {
    return NextResponse.json({ error: fetchFailureMessage(res) }, { status: 422 });
  }
  const { ogImage } = extractCardTags(res.body.toString("utf8"));
  const status = await classifyOgImage(db, user.id, ogImage, res.finalUrl);
  if (status === "live") await markLive(db, user.id);
  return NextResponse.json({
    status,
    message: MESSAGES[status],
    pageUrl: res.finalUrl,
    ogImage,
  });
}
