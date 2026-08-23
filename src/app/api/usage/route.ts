import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveApiKey } from "@/lib/keys";
import { getMonthlyUsage, getUserPlan } from "@/lib/usage";
import { PLANS, currentMonth } from "@/lib/plans";

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
  const [plan, used] = await Promise.all([
    getUserPlan(db, resolved.userId),
    getMonthlyUsage(db, resolved.userId),
  ]);
  return NextResponse.json({
    month: currentMonth(),
    plan,
    used,
    limit: PLANS[plan].monthlyRenders,
    remaining: Math.max(0, PLANS[plan].monthlyRenders - used),
    watermark: PLANS[plan].watermark,
  });
}
