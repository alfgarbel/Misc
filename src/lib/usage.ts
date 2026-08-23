import { sql, and, eq } from "drizzle-orm";
import type { Database } from "./db";
import { usage, subscriptions } from "./db/schema";
import { currentMonth, normalizePlan, withinQuota, type PlanId } from "./plans";

export async function getMonthlyUsage(
  db: Database,
  userId: string,
  month: string = currentMonth()
): Promise<number> {
  const row = await db.query.usage.findFirst({
    where: and(eq(usage.userId, userId), eq(usage.month, month)),
  });
  return row?.count ?? 0;
}

export async function incrementUsage(
  db: Database,
  userId: string,
  month: string = currentMonth()
): Promise<void> {
  await db
    .insert(usage)
    .values({ userId, month, count: 1 })
    .onConflictDoUpdate({
      target: [usage.userId, usage.month],
      set: { count: sql`${usage.count} + 1` },
    });
}

export async function getUserPlan(
  db: Database,
  userId: string
): Promise<PlanId> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (!sub) return "free";
  // A canceled/unpaid subscription falls back to free limits.
  if (sub.status !== "active" && sub.status !== "trialing") return "free";
  return normalizePlan(sub.plan);
}

export interface QuotaCheck {
  allowed: boolean;
  plan: PlanId;
  used: number;
}

/** Checks the user's quota and, when allowed, records one render. */
export async function checkAndRecordRender(
  db: Database,
  userId: string,
  now: Date = new Date()
): Promise<QuotaCheck> {
  const month = currentMonth(now);
  const [plan, used] = await Promise.all([
    getUserPlan(db, userId),
    getMonthlyUsage(db, userId, month),
  ]);
  if (!withinQuota(plan, used)) {
    return { allowed: false, plan, used };
  }
  await incrementUsage(db, userId, month);
  return { allowed: true, plan, used: used + 1 };
}
