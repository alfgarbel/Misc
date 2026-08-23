import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "./db";
import { usage, users } from "./db/schema";
import { PLANS, currentMonth, type PlanId } from "./plans";
import { sendEmail } from "./mailer";
import { appUrl } from "./stripe";

export type QuotaAlert = "80" | "100";

/**
 * Decides whether a quota alert is due and claims it atomically (the
 * conditional UPDATE only wins once per month, even across concurrent
 * requests). Returns the alert that was claimed, or null.
 */
export async function claimQuotaAlert(
  db: Database,
  userId: string,
  plan: PlanId,
  used: number,
  month: string = currentMonth()
): Promise<QuotaAlert | null> {
  const limit = PLANS[plan].monthlyRenders;
  const now = new Date();

  if (used >= limit) {
    const res = await db
      .update(usage)
      .set({ alert100At: now })
      .where(
        and(
          eq(usage.userId, userId),
          eq(usage.month, month),
          isNull(usage.alert100At)
        )
      );
    return res.rowsAffected > 0 ? "100" : null;
  }

  if (used >= Math.floor(limit * 0.8)) {
    const res = await db
      .update(usage)
      .set({ alert80At: now })
      .where(
        and(
          eq(usage.userId, userId),
          eq(usage.month, month),
          isNull(usage.alert80At)
        )
      );
    return res.rowsAffected > 0 ? "80" : null;
  }

  return null;
}

/** Checks thresholds and emails the account owner at most once per level. */
export async function maybeSendQuotaAlert(
  db: Database,
  userId: string,
  plan: PlanId,
  used: number,
  month: string = currentMonth()
): Promise<void> {
  try {
    const alert = await claimQuotaAlert(db, userId, plan, used, month);
    if (!alert) return;
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return;
    const limit = PLANS[plan].monthlyRenders;
    const base = appUrl();
    if (alert === "80") {
      await sendEmail({
        to: user.email,
        subject: "OGsmith: 80% of your monthly renders used",
        text: `Heads up — you've used ${used.toLocaleString()} of your ${limit.toLocaleString()} monthly renders on the ${PLANS[plan].name} plan.

If you expect more traffic this month, upgrade at ${base}/pricing to avoid interruptions. Usage details: ${base}/dashboard`,
      });
    } else {
      await sendEmail({
        to: user.email,
        subject: "OGsmith: monthly render quota reached",
        text: `You've hit your ${limit.toLocaleString()}-render monthly quota on the ${PLANS[plan].name} plan, so image requests now return 429 until the quota resets on the 1st (UTC).

Upgrade at ${base}/pricing to resume rendering immediately — the new quota applies as soon as the subscription is active.`,
      });
    }
  } catch (err) {
    // Alerts must never break rendering.
    console.error("quota alert failed:", err);
  }
}
