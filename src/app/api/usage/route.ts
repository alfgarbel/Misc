import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveApiKey } from "@/lib/keys";
import { getMonthlyUsage, getUserPlan } from "@/lib/usage";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PLANS, currentMonth } from "@/lib/plans";
import { effectiveWatermark } from "@/lib/trial";

export const runtime = "nodejs";

/**
 * Programmatic quota check:
 *   GET /api/usage?key=og_...   (or Authorization: Bearer og_...)
 */
export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const key = req.nextUrl.searchParams.get("key") ?? bearer;
  if (!key) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }
  const db = getDb();
  const resolved = await resolveApiKey(db, key);
  if (!resolved) {
    return NextResponse.json(
      { error: "Invalid or revoked API key" },
      { status: 401 }
    );
  }
  const [plan, used, account] = await Promise.all([
    getUserPlan(db, resolved.userId),
    getMonthlyUsage(db, resolved.userId),
    db.query.users.findFirst({ where: eq(users.id, resolved.userId) }),
  ]);
  const trialBearer = { trialEndsAt: account?.trialEndsAt ?? null };
  return NextResponse.json({
    month: currentMonth(),
    plan,
    used,
    limit: PLANS[plan].monthlyRenders,
    remaining: Math.max(0, PLANS[plan].monthlyRenders - used),
    // Reported so a caller can tell what their cards actually look like,
    // not merely what their plan says.
    watermark: effectiveWatermark(plan, trialBearer),
    trialEndsAt: account?.trialEndsAt?.toISOString() ?? null,
  });
}
