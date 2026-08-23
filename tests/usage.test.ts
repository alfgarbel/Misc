import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { createTestDb } from "./helpers";
import { users, subscriptions, usage } from "@/lib/db/schema";
import {
  getMonthlyUsage,
  incrementUsage,
  getUserPlan,
  checkAndRecordRender,
} from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { and, eq } from "drizzle-orm";

async function seedUser(
  db: Awaited<ReturnType<typeof createTestDb>>,
  plan = "free",
  status = "active"
) {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `${id}@test.dev`, passwordHash: "x" });
  await db.insert(subscriptions).values({ userId: id, plan, status });
  return id;
}

describe("usage metering", () => {
  it("starts at zero and increments atomically", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    expect(await getMonthlyUsage(db, userId)).toBe(0);
    await incrementUsage(db, userId, "2026-08");
    await incrementUsage(db, userId, "2026-08");
    expect(await getMonthlyUsage(db, userId, "2026-08")).toBe(2);
    // Different months are tracked separately.
    expect(await getMonthlyUsage(db, userId, "2026-09")).toBe(0);
  });

  it("resolves the plan, treating non-active subscriptions as free", async () => {
    const db = await createTestDb();
    expect(await getUserPlan(db, await seedUser(db, "pro", "active"))).toBe("pro");
    expect(await getUserPlan(db, await seedUser(db, "pro", "trialing"))).toBe("pro");
    expect(await getUserPlan(db, await seedUser(db, "pro", "past_due"))).toBe("free");
    expect(await getUserPlan(db, await seedUser(db, "pro", "canceled"))).toBe("free");
    // No subscription row at all → free.
    const bare = randomUUID();
    await db.insert(users).values({ id: bare, email: `${bare}@t.dev`, passwordHash: "x" });
    expect(await getUserPlan(db, bare)).toBe("free");
  });

  it("allows renders up to the quota, then blocks", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db, "free");
    const limit = PLANS.free.monthlyRenders;
    const now = new Date("2026-08-23T12:00:00Z");

    // Pre-fill the counter to one under the limit.
    await db.insert(usage).values({ userId, month: "2026-08", count: limit - 1 });

    const last = await checkAndRecordRender(db, userId, now);
    expect(last.allowed).toBe(true);
    expect(last.used).toBe(limit);

    const blocked = await checkAndRecordRender(db, userId, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.plan).toBe("free");

    // The blocked attempt must not have incremented the counter.
    const row = await db.query.usage.findFirst({
      where: and(eq(usage.userId, userId), eq(usage.month, "2026-08")),
    });
    expect(row?.count).toBe(limit);
  });

  it("quota resets in a new month", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db, "free");
    const limit = PLANS.free.monthlyRenders;
    await db.insert(usage).values({ userId, month: "2026-08", count: limit });

    const aug = await checkAndRecordRender(db, userId, new Date("2026-08-31T23:00:00Z"));
    expect(aug.allowed).toBe(false);
    const sep = await checkAndRecordRender(db, userId, new Date("2026-09-01T00:30:00Z"));
    expect(sep.allowed).toBe(true);
    expect(sep.used).toBe(1);
  });
});
