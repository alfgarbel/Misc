export type PlanId = "free" | "pro" | "scale";

/**
 * Displayed prices are net of tax: Stripe adds VAT on top at checkout based
 * on the customer's location, and zero-rates EU businesses that supply a
 * valid VAT number. Kept here so every surface words it identically.
 */
export const VAT_NOTE =
  "Prices exclude VAT. Tax is calculated at checkout from your billing country; EU businesses can enter a VAT number for reverse charge.";
export const VAT_SHORT = "excl. VAT";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthlyUsd: number;
  monthlyRenders: number;
  watermark: boolean;
  description: string;
  /** Custom designs saved from the visual editor. */
  templates: number;
  /** Uploaded images and font files, counted together. */
  assets: number;
  /** Split tests that can run at once. */
  experiments: number;
  /** Cards in a single batch. */
  batchRows: number;
  /** Endpoints notified of events. */
  webhooks: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    monthlyRenders: 500,
    watermark: true,
    description: "For side projects and trying things out.",
    templates: 1,
    assets: 3,
    experiments: 1,
    batchRows: 25,
    webhooks: 1,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyUsd: 19,
    monthlyRenders: 20_000,
    watermark: false,
    description: "For production sites and small businesses.",
    templates: 15,
    assets: 60,
    experiments: 5,
    batchRows: 200,
    webhooks: 5,
  },
  scale: {
    id: "scale",
    name: "Scale",
    priceMonthlyUsd: 49,
    monthlyRenders: 150_000,
    watermark: false,
    description: "For high-traffic sites and platforms.",
    templates: 100,
    assets: 400,
    experiments: 50,
    batchRows: 500,
    webhooks: 20,
  },
};

/**
 * A tier we advertise but cannot yet sell.
 *
 * Deliberately NOT a PlanId: PlanId is what the database stores and what
 * quota, watermarking and the Stripe webhook all switch on. A plan nobody
 * can be assigned to has no business in that type, and adding it would put
 * an unreachable branch in every one of those switches.
 */
export interface ComingSoonPlan {
  name: string;
  priceMonthlyUsd: number;
  description: string;
  /** Why someone would want it, in the same voice as PlanFeatures. */
  features: string[];
}

export const AGENCY_PREVIEW: ComingSoonPlan = {
  name: "Agency",
  priceMonthlyUsd: 99,
  description: "For studios running cards for a roster of clients.",
  features: [
    "Everything in Scale",
    "One workspace per client brand",
    "Separate templates, fonts and logos per brand",
    "Team seats with shared API keys",
    "Client-ready render reports",
  ],
};

export function isPaidPlan(plan: string): plan is "pro" | "scale" {
  return plan === "pro" || plan === "scale";
}

export function normalizePlan(plan: string | null | undefined): PlanId {
  if (plan === "pro" || plan === "scale") return plan;
  return "free";
}

/** Returns true if `count` renders this month is within the plan's quota. */
export function withinQuota(plan: PlanId, count: number): boolean {
  return count < PLANS[plan].monthlyRenders;
}

/** Current usage month key in UTC, e.g. "2026-08". */
export function currentMonth(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
