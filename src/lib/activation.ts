import { and, eq, gt, isNotNull, isNull, lte } from "drizzle-orm";
import type { Database } from "./db";
import { subscriptions, users } from "./db/schema";
import { sendEmail } from "./mailer";
import { PLANS } from "./plans";
import { appUrl } from "./stripe";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Two lifecycle emails, sent by a daily cron.
 *
 * The nudge goes to accounts that signed up a few days ago and have never
 * rendered a card — the people most likely to have got stuck rather than
 * lost interest. It stops being sent after a week: an email about a signup
 * someone has forgotten reads as spam, not help.
 *
 * The trial reminder goes two days before the watermark comes back, only to
 * accounts still on the free plan. Both go only to verified addresses.
 */
export const NUDGE_AFTER_DAYS = 3;
export const NUDGE_UNTIL_DAYS = 7;
export const TRIAL_REMINDER_DAYS = 2;

export interface ActivationRun {
  nudged: number;
  reminded: number;
}

/**
 * Claims an email column atomically — the conditional UPDATE only wins
 * once, so two overlapping cron runs can't both send.
 */
async function claim(
  db: Database,
  userId: string,
  column: "nudgeEmailAt" | "trialEmailAt",
  now: Date
): Promise<boolean> {
  const res = await db
    .update(users)
    .set({ [column]: now })
    .where(and(eq(users.id, userId), isNull(users[column])));
  return res.rowsAffected > 0;
}

/** Gives a claim back after a failed send, so tomorrow's run tries again. */
async function release(
  db: Database,
  userId: string,
  column: "nudgeEmailAt" | "trialEmailAt"
): Promise<void> {
  await db.update(users).set({ [column]: null }).where(eq(users.id, userId));
}

export function nudgeEmail(onboardingUrl: string | null): {
  subject: string;
  text: string;
} {
  const base = appUrl().replace(/\/$/, "");
  const target = onboardingUrl ?? "your page";
  return {
    subject: "Your first OGsmith card is one tag away",
    text: `Hi,

You signed up for OGsmith a few days ago but haven't put a card on a page yet. It takes one line in your page's <head>:

<meta property="og:image" content="${base}/api/og?key=YOUR_KEY&url=${onboardingUrl ? encodeURIComponent(onboardingUrl) : "https://your-site.com/page"}">

With url= OGsmith reads ${target} itself and builds the card from its title and description, so there's nothing else to fill in. Your key and a ready-made tag are on your dashboard:

${base}/dashboard

Once it's deployed, press "Check my page" on the dashboard and we'll confirm it's live.

If something got in the way, reply to this email and tell me what. I read every one.`,
  };
}

export function trialEmail(daysLeft: number): { subject: string; text: string } {
  const base = appUrl().replace(/\/$/, "");
  const when = daysLeft <= 1 ? "tomorrow" : `in ${daysLeft} days`;
  return {
    subject: `Your OGsmith trial ends ${when}`,
    text: `Hi,

Your OGsmith trial ends ${when}. After that, new cards on the Free plan carry a small "made with OGsmith" mark. Cards platforms have already cached keep their clean copy, so nothing you've shared changes overnight.

To keep every new card clean, Pro is $${PLANS.pro.priceMonthlyUsd}/month for ${PLANS.pro.monthlyRenders.toLocaleString()} renders:

${base}/pricing

Questions? Reply to this email.`,
  };
}

export async function runActivationEmails(
  db: Database,
  now: Date = new Date()
): Promise<ActivationRun> {
  const result: ActivationRun = { nudged: 0, reminded: 0 };

  const stuck = await db
    .select({ id: users.id, email: users.email, onboardingUrl: users.onboardingUrl })
    .from(users)
    .where(
      and(
        isNull(users.firstRenderAt),
        isNull(users.nudgeEmailAt),
        // Unconfirmed addresses may be typos or someone else's inbox.
        isNotNull(users.emailVerifiedAt),
        lte(users.createdAt, new Date(now.getTime() - NUDGE_AFTER_DAYS * DAY)),
        gt(users.createdAt, new Date(now.getTime() - NUDGE_UNTIL_DAYS * DAY))
      )
    );
  for (const user of stuck) {
    if (!(await claim(db, user.id, "nudgeEmailAt", now))) continue;
    if (await sendEmail({ to: user.email, ...nudgeEmail(user.onboardingUrl) })) {
      result.nudged += 1;
    } else {
      await release(db, user.id, "nudgeEmailAt");
    }
  }

  const ending = await db
    .select({ id: users.id, email: users.email, trialEndsAt: users.trialEndsAt })
    .from(users)
    .innerJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(
      and(
        eq(subscriptions.plan, "free"),
        isNull(users.trialEmailAt),
        isNotNull(users.emailVerifiedAt),
        gt(users.trialEndsAt, now),
        lte(users.trialEndsAt, new Date(now.getTime() + TRIAL_REMINDER_DAYS * DAY))
      )
    );
  for (const user of ending) {
    if (!user.trialEndsAt) continue;
    if (!(await claim(db, user.id, "trialEmailAt", now))) continue;
    const daysLeft = Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / DAY);
    if (await sendEmail({ to: user.email, ...trialEmail(daysLeft) })) {
      result.reminded += 1;
    } else {
      await release(db, user.id, "trialEmailAt");
    }
  }

  return result;
}
