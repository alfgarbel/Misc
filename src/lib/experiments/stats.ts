/**
 * Reading experiment results.
 *
 * Two things are deliberately conservative here. Exposures are crawler
 * fetches, not human impressions — a platform may fetch a card once and
 * show it a million times, or fetch it repeatedly and show it to nobody —
 * so a rate computed against exposures is not a click-through rate and is
 * never presented as one. And a comparison is reported as inconclusive
 * until there is enough data for the test to mean anything, because the
 * failure mode of an A/B tool is someone stopping at the first favourable
 * number they see.
 */

export interface VariantTotals {
  variantId: string;
  label: string;
  /** Pages assigned to this variant. */
  keys: number;
  /** Renders served — crawler fetches, not impressions. */
  exposures: number;
  /** Outcomes reported by the caller; we cannot observe these ourselves. */
  conversions: number;
}

/** Below this, the normal approximation behind the test isn't trustworthy. */
export const MIN_CONVERSIONS_PER_ARM = 5;
export const MIN_KEYS_PER_ARM = 20;

export interface Comparison {
  baseline: VariantTotals;
  challenger: VariantTotals;
  baselineRate: number;
  challengerRate: number;
  /** Relative change, e.g. 0.12 for 12% better than baseline. */
  lift: number | null;
  pValue: number | null;
  significant: boolean;
  /** Why no verdict is being offered, when there isn't one. */
  note: string | null;
}

/** Standard normal CDF, via a numerical approximation of erf. */
export function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26, accurate to about 1.5e-7.
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Two-proportion z-test, two-sided. Returns null when either arm is too
 * small for the approximation to hold.
 */
export function twoProportionPValue(
  conversionsA: number,
  totalA: number,
  conversionsB: number,
  totalB: number
): number | null {
  if (totalA <= 0 || totalB <= 0) return null;
  const p1 = conversionsA / totalA;
  const p2 = conversionsB / totalB;
  const pooled = (conversionsA + conversionsB) / (totalA + totalB);
  if (pooled <= 0 || pooled >= 1) return null;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / totalA + 1 / totalB));
  if (se === 0) return null;
  const z = (p2 - p1) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/**
 * Compares one variant against the baseline. Rates are conversions per
 * assigned page, not per exposure: a page is the thing that was randomised,
 * so it is the thing that can be counted once.
 */
export function compare(
  baseline: VariantTotals,
  challenger: VariantTotals
): Comparison {
  const baselineRate = baseline.keys > 0 ? baseline.conversions / baseline.keys : 0;
  const challengerRate =
    challenger.keys > 0 ? challenger.conversions / challenger.keys : 0;
  const lift =
    baselineRate > 0 ? (challengerRate - baselineRate) / baselineRate : null;

  let note: string | null = null;
  if (baseline.keys < MIN_KEYS_PER_ARM || challenger.keys < MIN_KEYS_PER_ARM) {
    note = `Needs at least ${MIN_KEYS_PER_ARM} pages in each variant.`;
  } else if (
    baseline.conversions < MIN_CONVERSIONS_PER_ARM ||
    challenger.conversions < MIN_CONVERSIONS_PER_ARM
  ) {
    note = `Needs at least ${MIN_CONVERSIONS_PER_ARM} reported outcomes in each variant.`;
  }

  const pValue = note
    ? null
    : twoProportionPValue(
        baseline.conversions,
        baseline.keys,
        challenger.conversions,
        challenger.keys
      );

  return {
    baseline,
    challenger,
    baselineRate,
    challengerRate,
    lift,
    pValue,
    significant: pValue !== null && pValue < 0.05,
    note,
  };
}

/** Compares every other variant against the first. */
export function compareAll(totals: VariantTotals[]): Comparison[] {
  if (totals.length < 2) return [];
  const [baseline, ...rest] = totals;
  return rest.map((challenger) => compare(baseline, challenger));
}
