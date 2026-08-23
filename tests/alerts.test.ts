import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { createTestDb } from "./helpers";
import { users, subscriptions, usage } from "@/lib/db/schema";
import { claimQuotaAlert } from "@/lib/alerts";
import { PLANS } from "@/lib/plans";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>) {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `${id}@t.dev`, passwordHash: "x" });
  await db.insert(subscriptions).values({ userId: id, plan: "free" });
  return id;
}

const LIMIT = PLANS.free.monthlyRenders; // 500
const M = "2026-08";

describe("quota alerts", () => {
  it("does not fire below the 80% threshold", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await db.insert(usage).values({ userId, month: M, count: 100 });
    expect(await claimQuotaAlert(db, userId, "free", 100, M)).toBeNull();
    expect(
      await claimQuotaAlert(db, userId, "free", Math.floor(LIMIT * 0.8) - 1, M)
    ).toBeNull();
  });

  it("fires the 80% alert exactly once", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const at80 = Math.floor(LIMIT * 0.8);
    await db.insert(usage).values({ userId, month: M, count: at80 });
    expect(await claimQuotaAlert(db, userId, "free", at80, M)).toBe("80");
    expect(await claimQuotaAlert(db, userId, "free", at80 + 1, M)).toBeNull();
    expect(await claimQuotaAlert(db, userId, "free", LIMIT - 1, M)).toBeNull();
  });

  it("fires the 100% alert exactly once, independent of the 80% one", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await db.insert(usage).values({ userId, month: M, count: LIMIT });
    expect(await claimQuotaAlert(db, userId, "free", LIMIT, M)).toBe("100");
    expect(await claimQuotaAlert(db, userId, "free", LIMIT, M)).toBeNull();
    // The 80% alert can still be claimed for reporting completeness…
    expect(await claimQuotaAlert(db, userId, "free", LIMIT - 1, M)).toBe("80");
  });

  it("resets per month", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const at80 = Math.floor(LIMIT * 0.8);
    await db.insert(usage).values({ userId, month: "2026-08", count: at80 });
    await db.insert(usage).values({ userId, month: "2026-09", count: at80 });
    expect(await claimQuotaAlert(db, userId, "free", at80, "2026-08")).toBe("80");
    expect(await claimQuotaAlert(db, userId, "free", at80, "2026-09")).toBe("80");
  });

  it("uses the plan's own limit", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await db.insert(usage).values({ userId, month: M, count: LIMIT });
    // 500 renders is 100% of free but far below 80% of pro.
    expect(await claimQuotaAlert(db, userId, "pro", LIMIT, M)).toBeNull();
  });
});
