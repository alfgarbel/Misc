import { sql, and, eq } from "drizzle-orm";
import type { Database } from "./db";
import { usage, subscriptions, apiKeys, keyUsage } from "./db/schema";
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

/** Attributes one render to a specific API key and bumps its last-used time. */
export async function recordKeyRender(
  db: Database,
  keyId: string,
  month: string = currentMonth()
): Promise<void> {
  await Promise.all([
    db
      .insert(keyUsage)
      .values({ keyId, month, count: 1 })
      .onConflictDoUpdate({
        target: [keyUsage.keyId, keyUsage.month],
        set: { count: sql`${keyUsage.count} + 1` },
      }),
    db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyId)),
  ]);
}

export interface MonthUsage {
  month: string;
  count: number;
}

/** Usage for the trailing `months` months (oldest first), zero-filled. */
export async function getUsageHistory(
  db: Database,
  userId: string,
  months = 6,
  now: Date = new Date()
): Promise<MonthUsage[]> {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(currentMonth(d));
  }
  const rows = await db.query.usage.findMany({
    where: eq(usage.userId, userId),
  });
  const byMonth = new Map(rows.map((r) => [r.month, r.count]));
  return keys.map((month) => ({ month, count: byMonth.get(month) ?? 0 }));
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
