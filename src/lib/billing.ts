import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { subscriptions } from "./db/schema";
import { bumpCacheVersion } from "./cachebust";

/**
 * Applies a subscription change, invalidating the account's cards when the
 * plan itself moved.
 *
 * Without the bump, paying to remove the watermark removes it from nothing
 * anyone can see: the image URL is unchanged, so every platform keeps
 * serving the watermarked copy it cached. The card only changes when its
 * URL does — which is what the cache version is for.
 *
 * A change that leaves the plan alone (a renewal, a status update) bumps
 * nothing, so routine billing traffic doesn't churn everyone's cards.
 */
export async function applySubscriptionChange(
  db: Database,
  customerId: string,
  set: Partial<typeof subscriptions.$inferInsert>
): Promise<{ updated: boolean; planChanged: boolean }> {
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeCustomerId, customerId),
  });
  if (!existing) return { updated: false, planChanged: false };

  await db
    .update(subscriptions)
    .set(set)
    .where(eq(subscriptions.stripeCustomerId, customerId));

  const planChanged = set.plan !== undefined && set.plan !== existing.plan;
  if (planChanged) {
    await bumpCacheVersion(db, existing.userId, { brandChanged: true });
  }
  return { updated: true, planChanged };
}
