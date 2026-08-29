import { describe, it, expect } from "vitest";
import {
  PLANS,
  withinQuota,
  currentMonth,
  normalizePlan,
  isPaidPlan,
  AGENCY_PREVIEW,
  VAT_SHORT,
  VAT_NOTE,
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

describe("the advertised Agency tier", () => {
  it("is not a plan anyone can be put on", () => {
    // It has no Stripe price and no quota, so a subscription row claiming it
    // must fall back to free rather than granting an undefined plan's limits.
    expect(normalizePlan("agency")).toBe("free");
    expect(isPaidPlan("agency")).toBe(false);
  });

  it("costs more than the plan it sits above", () => {
    // A coming-soon tier priced below Scale would read as a downgrade.
    expect(AGENCY_PREVIEW.priceMonthlyUsd).toBeGreaterThan(
      PLANS.scale.priceMonthlyUsd
    );
  });
});

describe("prices", () => {
  it("rise with each tier", () => {
    expect(PLANS.free.priceMonthlyUsd).toBe(0);
    expect(PLANS.pro.priceMonthlyUsd).toBeGreaterThan(PLANS.free.priceMonthlyUsd);
    expect(PLANS.scale.priceMonthlyUsd).toBeGreaterThan(PLANS.pro.priceMonthlyUsd);
  });

  it("buy more renders as they rise", () => {
    expect(PLANS.pro.monthlyRenders).toBeGreaterThan(PLANS.free.monthlyRenders);
    expect(PLANS.scale.monthlyRenders).toBeGreaterThan(PLANS.pro.monthlyRenders);
  });

  it("are quoted before tax everywhere they appear", () => {
    // Spain-based, so every displayed figure is net and Stripe adds VAT at
    // checkout. Losing this wording would make the prices misleading.
    expect(VAT_SHORT).toMatch(/excl\. VAT/i);
    expect(VAT_NOTE).toMatch(/exclude VAT/i);
    expect(VAT_NOTE).toMatch(/VAT number|reverse charge/i);
  });
});
