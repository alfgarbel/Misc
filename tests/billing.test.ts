import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers";
import { subscriptions, users } from "@/lib/db/schema";
import { provisionAccount } from "@/lib/accounts";
import { applySubscriptionChange } from "@/lib/billing";

async function seed() {
  const db = await createTestDb();
  const { userId } = await provisionAccount(db, {
    email: "o@example.com",
    passwordHash: "h",
  });
  await db
    .update(subscriptions)
    .set({ stripeCustomerId: "cus_123" })
    .where(eq(subscriptions.userId, userId));
  return { db, userId };
}

const versionOf = async (
  db: Awaited<ReturnType<typeof createTestDb>>,
  userId: string
) =>
  (await db.query.users.findFirst({ where: eq(users.id, userId) }))!.cacheVersion;

describe("applySubscriptionChange", () => {
  it("bumps the cache version when the plan moves", async () => {
    // Otherwise a customer pays to remove the watermark and every card
    // they have already shared keeps the cached, watermarked copy.
    const { db, userId } = await seed();
    const before = await versionOf(db, userId);

    const result = await applySubscriptionChange(db, "cus_123", {
      plan: "pro",
      status: "active",
    });

    expect(result).toEqual({ updated: true, planChanged: true });
    expect(await versionOf(db, userId)).toBeGreaterThan(before);
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });
    expect(sub?.plan).toBe("pro");
  });

  it("bumps on a downgrade too, since the cards change either way", async () => {
    const { db, userId } = await seed();
    await applySubscriptionChange(db, "cus_123", { plan: "pro" });
    const afterUpgrade = await versionOf(db, userId);
    await applySubscriptionChange(db, "cus_123", { plan: "free" });
    expect(await versionOf(db, userId)).toBeGreaterThan(afterUpgrade);
  });

  it("leaves the version alone when the plan didn't move", async () => {
    // Renewals and status updates arrive constantly; they must not churn
    // every card on the account.
    const { db, userId } = await seed();
    await applySubscriptionChange(db, "cus_123", { plan: "pro" });
    const settled = await versionOf(db, userId);

    for (const set of [
      { status: "active" },
      { plan: "pro", status: "past_due" },
      { currentPeriodEnd: new Date() },
    ]) {
      const result = await applySubscriptionChange(db, "cus_123", set);
      expect(result.planChanged).toBe(false);
    }
    expect(await versionOf(db, userId)).toBe(settled);
  });

  it("does nothing for a customer it doesn't know", async () => {
    const { db } = await seed();
    expect(await applySubscriptionChange(db, "cus_unknown", { plan: "pro" })).toEqual({
      updated: false,
      planChanged: false,
    });
  });
});
