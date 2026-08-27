import { describe, it, expect } from "vitest";
import {
  compare,
  compareAll,
  normalCdf,
  twoProportionPValue,
  MIN_CONVERSIONS_PER_ARM,
  MIN_KEYS_PER_ARM,
  type VariantTotals,
} from "@/lib/experiments/stats";

const arm = (
  id: string,
  keys: number,
  conversions: number,
  exposures = keys * 3
): VariantTotals => ({ variantId: id, label: id.toUpperCase(), keys, exposures, conversions });

describe("normalCdf", () => {
  it("matches known values of the standard normal", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeCloseTo(0.8413, 3);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 3);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("is symmetric about zero", () => {
    for (const z of [0.3, 1.1, 2.4, 3.5]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 6);
    }
  });
});

describe("twoProportionPValue", () => {
  it("gives a large p-value when the arms agree", () => {
    const p = twoProportionPValue(50, 500, 51, 500);
    expect(p).not.toBeNull();
    expect(p!).toBeGreaterThan(0.5);
  });

  it("gives a small p-value for a large, well-powered difference", () => {
    const p = twoProportionPValue(50, 1000, 120, 1000);
    expect(p).not.toBeNull();
    expect(p!).toBeLessThan(0.001);
  });

  it("crosses the conventional boundary in the right place", () => {
    // 128/1000 against 100/1000 is 1.97 standard errors apart, so it should
    // fall just under 0.05, and one conversion fewer just over.
    expect(twoProportionPValue(100, 1000, 128, 1000)!).toBeLessThan(0.05);
    expect(twoProportionPValue(100, 1000, 127, 1000)!).toBeGreaterThan(0.05);
  });

  it("agrees with an exact erf computation to four decimal places", () => {
    // normalCdf uses a numerical approximation of erf; these expected
    // values come from an exact implementation, so a regression in the
    // approximation would show up here rather than silently shifting
    // every verdict.
    const cases: Array<[number, number, number, number, number]> = [
      [50, 500, 51, 500, 0.916420],
      [30, 400, 55, 400, 0.004127],
      [50, 500, 54, 500, 0.678602],
      [100, 1000, 128, 1000, 0.048834],
    ];
    for (const [c1, n1, c2, n2, expected] of cases) {
      expect(twoProportionPValue(c1, n1, c2, n2)!).toBeCloseTo(expected, 4);
    }
  });

  it("is symmetric in the order of the arms", () => {
    const a = twoProportionPValue(30, 400, 55, 400)!;
    const b = twoProportionPValue(55, 400, 30, 400)!;
    expect(a).toBeCloseTo(b, 10);
  });

  it("returns null where the normal approximation cannot apply", () => {
    expect(twoProportionPValue(0, 0, 0, 0)).toBeNull();
    // No conversions anywhere: nothing to compare.
    expect(twoProportionPValue(0, 100, 0, 100)).toBeNull();
    // Everything converted: the pooled rate is 1.
    expect(twoProportionPValue(100, 100, 100, 100)).toBeNull();
  });
});

describe("compare", () => {
  it("withholds a verdict until each arm has enough pages", () => {
    const c = compare(arm("a", 5, 3), arm("b", 5, 1));
    expect(c.pValue).toBeNull();
    expect(c.significant).toBe(false);
    expect(c.note).toMatch(new RegExp(`${MIN_KEYS_PER_ARM} pages`));
  });

  it("withholds a verdict until enough outcomes have been reported", () => {
    const c = compare(arm("a", 100, 1), arm("b", 100, 2));
    expect(c.pValue).toBeNull();
    expect(c.note).toMatch(new RegExp(`${MIN_CONVERSIONS_PER_ARM} reported outcomes`));
  });

  it("calls a clear difference significant", () => {
    const c = compare(arm("a", 1000, 50), arm("b", 1000, 120));
    expect(c.note).toBeNull();
    expect(c.significant).toBe(true);
    expect(c.lift).toBeCloseTo(1.4, 1);
  });

  it("does not call a small difference significant", () => {
    const c = compare(arm("a", 500, 50), arm("b", 500, 54));
    expect(c.significant).toBe(false);
  });

  it("computes rates per assigned page, not per exposure", () => {
    // Exposures are crawler fetches and vary wildly per platform; the page
    // is the unit that was randomised, so it is the unit that is counted.
    const c = compare(arm("a", 100, 10, 100), arm("b", 100, 20, 99999));
    expect(c.baselineRate).toBeCloseTo(0.1, 6);
    expect(c.challengerRate).toBeCloseTo(0.2, 6);
  });

  it("reports no lift when the baseline has converted nothing", () => {
    const c = compare(arm("a", 100, 0), arm("b", 100, 10));
    expect(c.lift).toBeNull();
  });

  it("handles an empty arm without dividing by zero", () => {
    const c = compare(arm("a", 0, 0), arm("b", 0, 0));
    expect(c.baselineRate).toBe(0);
    expect(c.challengerRate).toBe(0);
    expect(c.significant).toBe(false);
  });
});

describe("compareAll", () => {
  it("compares every other variant against the first", () => {
    const out = compareAll([arm("a", 100, 10), arm("b", 100, 20), arm("c", 100, 30)]);
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.challenger.variantId)).toEqual(["b", "c"]);
    expect(out.every((c) => c.baseline.variantId === "a")).toBe(true);
  });

  it("has nothing to compare with fewer than two variants", () => {
    expect(compareAll([arm("a", 10, 1)])).toEqual([]);
    expect(compareAll([])).toEqual([]);
  });
});
