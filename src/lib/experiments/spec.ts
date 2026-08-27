import { createHash } from "crypto";
import { z } from "zod";

/**
 * Split testing for cards.
 *
 * The constraint that shapes everything here: a social platform fetches a
 * card's image once and shows that single copy to everyone who sees the
 * post. There is no per-viewer request to split on, so a viewer-level A/B
 * test is not possible — not difficult, impossible. What is possible is
 * randomising at the level of the page: half an account's articles get
 * design A, half get design B, and the two cohorts are compared.
 *
 * That makes stability the critical property. A page's variant is decided
 * once and stored; it must never be recomputed, or editing an experiment
 * would change the artwork on posts that are already out in the world.
 */

/** Parameters a variant may override. Anything else is not a card design. */
export const VARIANT_PARAMS = [
  "template",
  "theme",
  "accent",
  "title",
  "subtitle",
  "site",
  "tpl",
] as const;

export const MAX_VARIANTS = 4;
export const MIN_VARIANTS = 2;

export const variantSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,23}$/, "must be a short lowercase id"),
  label: z.string().min(1).max(60),
  /** Relative share. Two variants at 1 and 3 split 25/75. */
  weight: z.number().int().min(1).max(1000).default(1),
  // Spelled out rather than a record so unknown keys are rejected with a
  // message instead of silently dropped — a variant that quietly ignores
  // the parameter you set is a confusing experiment.
  params: z
    .object({
      template: z.string().max(300).optional(),
      theme: z.string().max(300).optional(),
      accent: z.string().max(300).optional(),
      title: z.string().max(300).optional(),
      subtitle: z.string().max(300).optional(),
      site: z.string().max(300).optional(),
      tpl: z.string().max(300).optional(),
    })
    .strict()
    .default({}),
});

export const variantsSchema = z
  .array(variantSchema)
  .min(MIN_VARIANTS)
  .max(MAX_VARIANTS)
  .refine(
    (v) => new Set(v.map((x) => x.id)).size === v.length,
    "variant ids must be unique"
  );

export type Variant = z.infer<typeof variantSchema>;

export function parseVariants(json: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { success: false as const, error: "Variants are not valid JSON" };
  }
  const parsed = variantsSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false as const,
      error: `Variants are invalid: ${issue.path.join(".")} ${issue.message}`,
    };
  }
  return { success: true as const, data: parsed.data };
}

const BUCKETS = 10_000;

/**
 * Maps a key into 0..9999, evenly and repeatably. A hash rather than a
 * random number, so the same page always lands in the same place, on any
 * server, forever — which is what lets an assignment be recomputed
 * identically if a stored one is ever lost.
 */
export function bucketOf(experimentSlug: string, key: string): number {
  const digest = createHash("sha256")
    .update(`${experimentSlug}:${key}`)
    .digest();
  return digest.readUInt32BE(0) % BUCKETS;
}

/**
 * Picks the variant a bucket falls into, walking the weights in order.
 * Returns null only when there are no variants to choose from.
 */
export function variantForBucket(
  variants: Variant[],
  bucket: number
): Variant | null {
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  if (variants.length === 0 || total <= 0) return null;
  const target = (bucket / BUCKETS) * total;
  let running = 0;
  for (const variant of variants) {
    running += variant.weight;
    if (target < running) return variant;
  }
  return variants[variants.length - 1];
}

/** The variant a key would be given, ignoring any stored assignment. */
export function assignVariant(
  experimentSlug: string,
  key: string,
  variants: Variant[]
): Variant | null {
  return variantForBucket(variants, bucketOf(experimentSlug, key));
}

/** Applies a variant's overrides. Explicit request parameters still win. */
export function applyVariant(
  params: URLSearchParams,
  variant: Variant
): URLSearchParams {
  const merged = new URLSearchParams(params);
  for (const [name, value] of Object.entries(variant.params)) {
    if (value && !merged.get(name)) merged.set(name, value);
  }
  return merged;
}

export function starterVariants(): Variant[] {
  return variantsSchema.parse([
    { id: "a", label: "A — gradient", weight: 1, params: { template: "gradient" } },
    { id: "b", label: "B — minimal", weight: 1, params: { template: "minimal" } },
  ]);
}
