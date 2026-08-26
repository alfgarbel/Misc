import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { acknowledgeRepublish, bumpCacheVersion } from "@/lib/cachebust";
import { makeRateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";

// A bump is cheap for us but invalidates every cached card, so it isn't
// something an account should be able to do in a tight loop.
const bumpLimiter = makeRateLimiter(20);

/** Force a new cache version, e.g. after editing a template upstream. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (bumpLimiter.limited(user.id)) {
    return NextResponse.json(
      { error: "Too many refreshes. Try again in a minute." },
      { status: 429 }
    );
  }
  const version = await bumpCacheVersion(getDb(), user.id, {
    brandChanged: true,
  });
  return NextResponse.json({ ok: true, version });
}

/** Dismiss the "republish your URLs" reminder without changing the version. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  await acknowledgeRepublish(getDb(), user.id);
  return NextResponse.json({ ok: true });
}
