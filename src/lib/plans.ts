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
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    monthlyRenders: 500,
    watermark: true,
    description: "For side projects and trying things out.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyUsd: 9,
    monthlyRenders: 20_000,
    watermark: false,
    description: "For production sites and small businesses.",
  },
  scale: {
    id: "scale",
    name: "Scale",
    priceMonthlyUsd: 29,
    monthlyRenders: 150_000,
    watermark: false,
    description: "For high-traffic sites and platforms.",
  },
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
