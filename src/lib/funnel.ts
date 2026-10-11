import { randomUUID } from "crypto";
import { and, count, countDistinct, eq, gte, isNull } from "drizzle-orm";
import type { Database } from "./db";
import { events, users } from "./db/schema";

/**
 * The steps between finding OGsmith and paying for it, in order.
 *
 * There is no "created a key" step: every account gets a key at signup, so
 * it would always equal signups. The step that actually separates people
 * who will stay from people who won't is the first render, and after that
 * the first time a card shows up on a real page.
 */
export const FUNNEL_STEPS = [
  "check_run",
  "signup",
  "first_render",
  "live",
  "checkout",
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const FUNNEL_LABELS: Record<FunnelStep, string> = {
  check_run: "Ran the checker",
  signup: "Signed up",
  first_render: "Rendered a card",
  live: "Card live on a real page",
  checkout: "Paid",
};

/**
 * Records a funnel step. Never throws: losing an analytics row must not
 * fail a signup, a render or a webhook.
 */
export async function recordEvent(
  db: Database,
  name: FunnelStep,
  userId: string | null = null,
  now: Date = new Date()
): Promise<void> {
  try {
    await db.insert(events).values({ id: randomUUID(), name, userId, createdAt: now });
  } catch (err) {
    console.error(`[funnel] could not record ${name}:`, err);
  }
}

/**
 * The bots platforms send to fetch a card when a link is shared. A render
 * requested by one of these means the card is on a page someone shared —
 * the strongest signal there is that an account is really using OGsmith.
 */
const SOCIAL_CRAWLER =
  /facebookexternalhit|facebookcatalog|meta-externalagent|Facebot|Twitterbot|LinkedInBot|Slackbot|Slack-ImgProxy|Discordbot|WhatsApp|TelegramBot|Applebot|SkypeUriPreview|redditbot|Pinterestbot|Embedly|vkShare|Mastodon|Iframely|Bluesky|Cardyb/i;

export function isSocialCrawler(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && SOCIAL_CRAWLER.test(userAgent));
}

/**
 * Sets a milestone column if it isn't set yet and records the matching
 * event. The conditional UPDATE is the claim, so concurrent renders can't
 * record the step twice.
 */
async function claimMilestone(
  db: Database,
  userId: string,
  column: "firstRenderAt" | "liveAt",
  step: FunnelStep,
  now: Date
): Promise<boolean> {
  const res = await db
    .update(users)
    .set({ [column]: now })
    .where(and(eq(users.id, userId), isNull(users[column])));
  if (res.rowsAffected === 0) return false;
  await recordEvent(db, step, userId, now);
  return true;
}

/**
 * Called on every authenticated render. Cheap in the common case: the
 * account row is already loaded, so once both milestones are set this does
 * no database work at all.
 */
export async function trackRender(
  db: Database,
  account: { id: string; firstRenderAt: Date | null; liveAt: Date | null },
  userAgent: string | null,
  now: Date = new Date()
): Promise<void> {
  try {
    if (!account.firstRenderAt) {
      await claimMilestone(db, account.id, "firstRenderAt", "first_render", now);
    }
    if (!account.liveAt && isSocialCrawler(userAgent)) {
      await claimMilestone(db, account.id, "liveAt", "live", now);
    }
  } catch (err) {
    console.error("[funnel] trackRender failed:", err);
  }
}

/** Marks an account live after the dashboard found its card on a page. */
export async function markLive(
  db: Database,
  userId: string,
  now: Date = new Date()
): Promise<void> {
  // A live card has necessarily been rendered, even if the render that
  // proved it was a crawler we didn't recognise.
  await claimMilestone(db, userId, "firstRenderAt", "first_render", now);
  await claimMilestone(db, userId, "liveAt", "live", now);
}

export interface FunnelRow {
  step: FunnelStep;
  label: string;
  /** Events for anonymous steps, distinct accounts for the rest. */
  count: number;
  /** Share of the previous step, or null for the first step. */
  fromPrevious: number | null;
}

/**
 * Counts each step over the window. Steps are counted independently, so a
 * later step can exceed an earlier one (someone who signed up last month
 * and rendered this week) — the percentages are a rough guide to where
 * people stop, not a cohort analysis.
 */
export async function getFunnel(
  db: Database,
  days = 30,
  now: Date = new Date()
): Promise<FunnelRow[]> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await Promise.all(
    FUNNEL_STEPS.map(async (step) => {
      const [row] = await db
        .select({
          total: count(),
          accounts: countDistinct(events.userId),
        })
        .from(events)
        .where(and(eq(events.name, step), gte(events.createdAt, since)));
      return step === "check_run" ? (row?.total ?? 0) : (row?.accounts ?? 0);
    })
  );
  return FUNNEL_STEPS.map((step, i) => ({
    step,
    label: FUNNEL_LABELS[step],
    count: rows[i],
    fromPrevious:
      i === 0 ? null : rows[i - 1] > 0 ? Math.round((rows[i] / rows[i - 1]) * 100) : null,
  }));
}
