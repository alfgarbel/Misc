import { desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "./db";
import { users, subscriptions, usage, apiKeys } from "./db/schema";
import { PLANS, currentMonth } from "./plans";

/** Admins are configured via ADMIN_EMAILS (comma-separated, case-insensitive). */
export function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/**
 * Admin access requires both a listed email AND a verified address —
 * otherwise whoever registers a listed address first would get in.
 */
export function isAdminUser(user: {
  email: string;
  emailVerifiedAt: Date | null;
}): boolean {
  return Boolean(user.emailVerifiedAt) && isAdminEmail(user.email);
}

export interface DayCount {
  day: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface AdminMetrics {
  totalUsers: number;
  verifiedUsers: number;
  payingCustomers: number;
  planCounts: { free: number; pro: number; scale: number };
  mrrUsd: number;
  activeKeys: number;
  rendersThisMonth: number;
  signupsLast30Days: DayCount[]; // oldest first, zero-filled
  rendersByMonth: { month: string; count: number }[]; // trailing 6, oldest first
  topAccounts: { email: string; renders: number; plan: string }[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getAdminMetrics(
  db: Database,
  now: Date = new Date()
): Promise<AdminMetrics> {
  const month = currentMonth(now);
  const since = new Date(now.getTime() - 29 * 86_400_000);

  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(currentMonth(d));
  }

  const [
    [{ n: totalUsers }],
    [{ n: verifiedUsers }],
    paidSubs,
    [{ n: activeKeys }],
    recentSignups,
    usageRows,
    topUsage,
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(users),
    db
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.emailVerifiedAt} is not null`),
    db.query.subscriptions.findMany({
      where: inArray(subscriptions.status, ["active", "trialing"]),
      columns: { plan: true },
    }),
    db
      .select({ n: sql<number>`count(*)` })
      .from(apiKeys)
      .where(isNull(apiKeys.revokedAt)),
    db.query.users.findMany({
      where: gte(users.createdAt, since),
      columns: { createdAt: true },
    }),
    db.query.usage.findMany({
      where: inArray(usage.month, monthKeys),
      columns: { month: true, count: true },
    }),
    db
      .select({ userId: usage.userId, count: usage.count })
      .from(usage)
      .where(eq(usage.month, month))
      .orderBy(desc(usage.count))
      .limit(10),
  ]);

  const planCounts = { free: 0, pro: 0, scale: 0 };
  for (const s of paidSubs) {
    if (s.plan === "pro") planCounts.pro += 1;
    else if (s.plan === "scale") planCounts.scale += 1;
  }
  planCounts.free = Math.max(0, totalUsers - planCounts.pro - planCounts.scale);

  // At today's list price. Stripe keeps existing subscriptions on the price
  // they were created with, so after any price rise this over-states real
  // revenue until everyone has churned or resubscribed. Stripe's own
  // dashboard is the number to trust; this one is a rough gauge.
  const mrrUsd =
    planCounts.pro * PLANS.pro.priceMonthlyUsd +
    planCounts.scale * PLANS.scale.priceMonthlyUsd;

  const signupsByDay = new Map<string, number>();
  for (const u of recentSignups) {
    const k = dayKey(u.createdAt);
    signupsByDay.set(k, (signupsByDay.get(k) ?? 0) + 1);
  }
  const signupsLast30Days: DayCount[] = [];
  for (let i = 29; i >= 0; i--) {
    const k = dayKey(new Date(now.getTime() - i * 86_400_000));
    signupsLast30Days.push({ day: k, count: signupsByDay.get(k) ?? 0 });
  }

  const rendersPerMonth = new Map<string, number>();
  for (const r of usageRows) {
    rendersPerMonth.set(r.month, (rendersPerMonth.get(r.month) ?? 0) + r.count);
  }
  const rendersByMonth = monthKeys.map((m) => ({
    month: m,
    count: rendersPerMonth.get(m) ?? 0,
  }));

  const topIds = topUsage.map((t) => t.userId);
  const [topUsers, topSubs] =
    topIds.length > 0
      ? await Promise.all([
          db.query.users.findMany({
            where: inArray(users.id, topIds),
            columns: { id: true, email: true },
          }),
          db.query.subscriptions.findMany({
            where: inArray(subscriptions.userId, topIds),
            columns: { userId: true, plan: true, status: true },
          }),
        ])
      : [[], []];
  const emailById = new Map(topUsers.map((u) => [u.id, u.email]));
  const planById = new Map(
    topSubs.map((s) => [
      s.userId,
      s.status === "active" || s.status === "trialing" ? s.plan : "free",
    ])
  );

  return {
    totalUsers,
    verifiedUsers,
    payingCustomers: planCounts.pro + planCounts.scale,
    planCounts,
    mrrUsd,
    activeKeys,
    rendersThisMonth: rendersPerMonth.get(month) ?? 0,
    signupsLast30Days,
    rendersByMonth,
    topAccounts: topUsage.map((t) => ({
      email: emailById.get(t.userId) ?? "(deleted)",
      renders: t.count,
      plan: planById.get(t.userId) ?? "free",
    })),
  };
}
