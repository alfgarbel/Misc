import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { coerceUrl } from "@/lib/checker";
import { saveOnboardingUrl } from "@/lib/onboarding";

export const runtime = "nodejs";

const bodySchema = z.object({ url: z.string().min(1).max(2000) });

/**
 * Remembers the page someone checked before signing up, so the dashboard
 * can open on their card instead of an example. The signup page hands it
 * over through sessionStorage, which survives the Google redirect as well
 * as the password form.
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
  await saveOnboardingUrl(getDb(), user.id, url);
  return NextResponse.json({ ok: true, url });
}
