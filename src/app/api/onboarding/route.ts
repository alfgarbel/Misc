import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { coerceUrl } from "@/lib/checker";
import { saveOnboardingUrl } from "@/lib/onboarding";
import { applyDetectedBrand, brandIsUntouched, detectBrand } from "@/lib/brand-detect";

export const runtime = "nodejs";

const bodySchema = z.object({ url: z.string().min(1).max(2000) });

/**
 * Remembers the page someone checked before signing up, so the dashboard
 * can open on their card instead of an example. The signup page hands it
 * over through sessionStorage, which survives the Google redirect as well
 * as the password form.
 *
 * For an account whose brand is still empty, the same page also supplies
 * its name, colour and icon as brand defaults, so the first card looks like
 * the site it's for.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  const url = parsed.success ? coerceUrl(parsed.data.url) : null;
  if (!url) {
    return NextResponse.json({ error: "Enter a web address" }, { status: 400 });
  }
  const db = getDb();
  await saveOnboardingUrl(db, user.id, url);
  let brandApplied = false;
  if (brandIsUntouched(user)) {
    const detected = await detectBrand(url).catch(() => null);
    if (detected) brandApplied = await applyDetectedBrand(db, user, detected);
  }
  return NextResponse.json({ ok: true, url, brandApplied });
}
