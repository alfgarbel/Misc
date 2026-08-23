import { describe, it, expect } from "vitest";
import {
  PLANS,
  withinQuota,
  currentMonth,
  normalizePlan,
  isPaidPlan,
} from "@/lib/plans";

describe("plans", () => {
  it("enforces quota boundaries exactly", () => {
    expect(withinQuota("free", 0)).toBe(true);
    expect(withinQuota("free", PLANS.free.monthlyRenders - 1)).toBe(true);
    expect(withinQuota("free", PLANS.free.monthlyRenders)).toBe(false);
    expect(withinQuota("pro", PLANS.free.monthlyRenders)).toBe(true);
    expect(withinQuota("scale", PLANS.pro.monthlyRenders)).toBe(true);
  });

  it("computes UTC month keys", () => {
    expect(currentMonth(new Date("2026-08-23T10:00:00Z"))).toBe("2026-08");
    expect(currentMonth(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
    // Local-time edge: Dec 31 23:59 UTC is still December.
    expect(currentMonth(new Date("2025-12-31T23:59:59Z"))).toBe("2025-12");
  });

  it("normalizes unknown plan strings to free", () => {
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("scale")).toBe("scale");
    expect(normalizePlan("enterprise")).toBe("free");
    expect(normalizePlan(null)).toBe("free");
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan("pro")).toBe(true);
  });

  it("free plan is watermarked, paid plans are not", () => {
    expect(PLANS.free.watermark).toBe(true);
    expect(PLANS.pro.watermark).toBe(false);
    expect(PLANS.scale.watermark).toBe(false);
  });
});
