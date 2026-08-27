import { PLANS, type PlanId } from "./plans";

/**
 * A new account renders clean for a fortnight.
 *
 * The problem this solves is evaluation, not generosity: with a watermark
 * on every free render there is no way to put a real card on a real site
 * before paying, so the only way to find out whether OGsmith works for you
 * is to buy it first.
 *
 * Nothing is taken away at the end. Cards already fetched keep the clean
 * copy the platforms cached — only new renders pick up the watermark — so
 * a trial ending is a soft landing rather than a site changing overnight.
 */
export const TRIAL_DAYS = 14;

export function trialEndFor(now: Date = new Date()): Date {
  return new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export interface TrialBearer {
  trialEndsAt: Date | null;
}

export function trialActive(
  user: TrialBearer,
  now: Date = new Date()
): boolean {
  return user.trialEndsAt !== null && user.trialEndsAt.getTime() > now.getTime();
}

/** Whole days remaining, rounded up, or 0 once it has ended. */
export function trialDaysLeft(
  user: TrialBearer,
  now: Date = new Date()
): number {
  if (!user.trialEndsAt) return 0;
  const ms = user.trialEndsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Whether this render carries the watermark.
 *
 * The single place that decision is made. It is a property of the account
 * rather than of a request, so every card on a site looks the same — a
 * per-render rule would watermark some posts and not others depending on
 * the order crawlers happened to arrive in.
 */
export function effectiveWatermark(
  plan: PlanId,
  user: TrialBearer,
  now: Date = new Date()
): boolean {
  if (!PLANS[plan].watermark) return false;
  return !trialActive(user, now);
}
