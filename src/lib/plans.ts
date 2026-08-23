export type PlanId = "free" | "pro" | "scale";

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
