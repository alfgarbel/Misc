import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./helpers";
import type { Database } from "@/lib/db";
import { provisionAccount } from "@/lib/accounts";
import {
  applyVariant,
  assignVariant,
  assignmentFor,
  bucketOf,
  createExperiment,
  deleteExperiment,
  experimentTotals,
  getOwnedExperiment,
  parseVariants,
  recordConversion,
  starterVariants,
  updateExperiment,
  variantForBucket,
  variantsSchema,
  type Variant,
} from "@/lib/experiments";

const twoWay: Variant[] = variantsSchema.parse([
  { id: "a", label: "A", weight: 1, params: { template: "gradient" } },
  { id: "b", label: "B", weight: 1, params: { template: "minimal" } },
]);

describe("bucketOf", () => {
  it("is stable for the same experiment and key", () => {
    const first = bucketOf("headline-test", "https://example.com/post-1");
    for (let i = 0; i < 50; i++) {
      expect(bucketOf("headline-test", "https://example.com/post-1")).toBe(first);
    }
  });

  it("differs between experiments, so two tests don't correlate", () => {
    // If both tests bucketed identically, a page in A here would always be
    // in A there, and the second experiment would be confounded.
    let differing = 0;
    for (let i = 0; i < 200; i++) {
      if (bucketOf("exp-one", `key-${i}`) !== bucketOf("exp-two", `key-${i}`)) {
        differing += 1;
      }
    }
    expect(differing).toBeGreaterThan(190);
  });

  it("spreads keys evenly across the range", () => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      counts[Math.floor(bucketOf("t", `key-${i}`) / 2500)] += 1;
    }
    // Each quarter should hold roughly 1000; allow generous slack.
    for (const c of counts) {
      expect(c).toBeGreaterThan(850);
      expect(c).toBeLessThan(1150);
    }
  });
});

describe("variantForBucket", () => {
  it("splits an even two-way test close to 50/50", () => {
    let a = 0;
    for (let i = 0; i < 4000; i++) {
      if (assignVariant("t", `key-${i}`, twoWay)!.id === "a") a += 1;
    }
    expect(a).toBeGreaterThan(1850);
    expect(a).toBeLessThan(2150);
  });

  it("honours uneven weights", () => {
    const weighted = variantsSchema.parse([
      { id: "a", label: "A", weight: 3, params: {} },
      { id: "b", label: "B", weight: 1, params: {} },
    ]);
    let a = 0;
    for (let i = 0; i < 4000; i++) {
      if (assignVariant("t", `key-${i}`, weighted)!.id === "a") a += 1;
    }
    // Expect about 3000 of 4000.
    expect(a).toBeGreaterThan(2850);
    expect(a).toBeLessThan(3150);
  });

  it("covers the whole range without gaps", () => {
    for (const bucket of [0, 1, 4999, 5000, 9999]) {
      expect(variantForBucket(twoWay, bucket)).not.toBeNull();
    }
  });

  it("returns null only when there is nothing to choose", () => {
    expect(variantForBucket([], 0)).toBeNull();
  });
});

describe("applyVariant", () => {
  it("applies the variant's overrides", () => {
    const out = applyVariant(new URLSearchParams({ title: "Hi" }), twoWay[1]);
    expect(out.get("template")).toBe("minimal");
    expect(out.get("title")).toBe("Hi");
  });

  it("never overrides what the caller stated explicitly", () => {
    const out = applyVariant(new URLSearchParams({ template: "terminal" }), twoWay[1]);
    expect(out.get("template")).toBe("terminal");
  });

  it("does not mutate the params it was given", () => {
    const original = new URLSearchParams();
    applyVariant(original, twoWay[0]);
    expect(original.get("template")).toBeNull();
  });
});

describe("variantsSchema", () => {
  it("requires at least two variants", () => {
    expect(variantsSchema.safeParse([{ id: "a", label: "A" }]).success).toBe(false);
  });

  it("rejects duplicate ids", () => {
    const dup = [
      { id: "a", label: "A" },
      { id: "a", label: "Also A" },
    ];
    expect(variantsSchema.safeParse(dup).success).toBe(false);
  });

  it("rejects a parameter that isn't a card design", () => {
    const sneaky = [
      { id: "a", label: "A", params: { key: "og_stolen" } },
      { id: "b", label: "B" },
    ];
    expect(variantsSchema.safeParse(sneaky).success).toBe(false);
  });

  it("reports bad stored JSON rather than throwing", () => {
    expect(parseVariants("{not json").success).toBe(false);
    expect(parseVariants('[{"id":"a"}]').success).toBe(false);
  });
});

async function seed() {
  const db = await createTestDb();
  const owner = await provisionAccount(db, { email: "o@example.com", passwordHash: "h" });
  const other = await provisionAccount(db, { email: "x@example.com", passwordHash: "h" });
  return { db, ownerId: owner.userId, otherId: other.userId };
}

describe("assignmentFor", () => {
  let db: Database;
  let ownerId: string;
  beforeEach(async () => {
    const s = await seed();
    db = s.db;
    ownerId = s.ownerId;
  });

  it("gives the same page the same variant every time", async () => {
    const exp = await createExperiment(db, ownerId, { name: "Headlines", variants: twoWay });
    const first = await assignmentFor(db, exp, "post-1", { countExposure: true });
    expect(first?.isNew).toBe(true);
    for (let i = 0; i < 10; i++) {
      const again = await assignmentFor(db, exp, "post-1", { countExposure: true });
      expect(again?.variant.id).toBe(first!.variant.id);
      expect(again?.isNew).toBe(false);
    }
  });

  it("keeps a page on its original variant after the weights change", async () => {
    // This is the property that makes results trustworthy: a post already
    // shared must not silently change artwork when the experiment is edited.
    const exp = await createExperiment(db, ownerId, { name: "Headlines", variants: twoWay });
    const before = await assignmentFor(db, exp, "post-1", { countExposure: true });

    const skewed = variantsSchema.parse([
      { id: "a", label: "A", weight: 1, params: {} },
      { id: "b", label: "B", weight: 999, params: {} },
    ]);
    const updated = await updateExperiment(db, ownerId, exp.id, { variants: skewed });
    const after = await assignmentFor(db, updated!, "post-1", { countExposure: true });
    expect(after?.variant.id).toBe(before!.variant.id);
  });

  it("counts one exposure per render", async () => {
    const exp = await createExperiment(db, ownerId, { name: "E", variants: twoWay });
    for (let i = 0; i < 5; i++) {
      await assignmentFor(db, exp, "post-1", { countExposure: true });
    }
    const totals = await experimentTotals(db, exp);
    expect(totals.reduce((n, t) => n + t.exposures, 0)).toBe(5);
    expect(totals.reduce((n, t) => n + t.keys, 0)).toBe(1);
  });

  it("does not count an exposure when only asked what the variant is", async () => {
    const exp = await createExperiment(db, ownerId, { name: "E", variants: twoWay });
    await assignmentFor(db, exp, "post-1");
    const totals = await experimentTotals(db, exp);
    expect(totals.reduce((n, t) => n + t.exposures, 0)).toBe(0);
    expect(totals.reduce((n, t) => n + t.keys, 0)).toBe(1);
  });

  it("falls back rather than failing when a variant was deleted", async () => {
    const exp = await createExperiment(db, ownerId, { name: "E", variants: twoWay });
    // Force the page onto "b", then remove that variant.
    let key = "post-1";
    for (let i = 0; i < 50; i++) {
      const a = await assignmentFor(db, exp, `k-${i}`);
      if (a?.variant.id === "b") {
        key = `k-${i}`;
        break;
      }
    }
    const narrowed = variantsSchema.parse([
      { id: "a", label: "A", weight: 1, params: {} },
      { id: "c", label: "C", weight: 1, params: {} },
    ]);
    const updated = await updateExperiment(db, ownerId, exp.id, { variants: narrowed });
    const after = await assignmentFor(db, updated!, key, { countExposure: true });
    expect(after).not.toBeNull();
    expect(["a", "c"]).toContain(after!.variant.id);
  });

  it("reports totals for variants that have seen nothing", async () => {
    const exp = await createExperiment(db, ownerId, { name: "E", variants: twoWay });
    const totals = await experimentTotals(db, exp);
    expect(totals).toHaveLength(2);
    expect(totals.every((t) => t.keys === 0)).toBe(true);
  });
});

describe("recordConversion", () => {
  it("counts an outcome against the page's variant", async () => {
    const { db, ownerId } = await seed();
    const exp = await createExperiment(db, ownerId, { name: "E", variants: twoWay });
    const assigned = await assignmentFor(db, exp, "post-1", { countExposure: true });
    expect(await recordConversion(db, exp.id, "post-1")).toBe(true);

    const totals = await experimentTotals(db, exp);
    const arm = totals.find((t) => t.variantId === assigned!.variant.id);
    expect(arm?.conversions).toBe(1);
  });

  it("refuses an outcome for a page that was never assigned", async () => {
    const { db, ownerId } = await seed();
    const exp = await createExperiment(db, ownerId, { name: "E", variants: twoWay });
    expect(await recordConversion(db, exp.id, "never-seen")).toBe(false);
  });
});

describe("ownership", () => {
  it("will not read, update or delete another account's experiment", async () => {
    const { db, ownerId, otherId } = await seed();
    const exp = await createExperiment(db, ownerId, { name: "Mine", variants: starterVariants() });
    expect(await getOwnedExperiment(db, otherId, exp.id)).toBeNull();
    expect(await updateExperiment(db, otherId, exp.id, { name: "Yours" })).toBeNull();
    expect(await deleteExperiment(db, otherId, exp.id)).toBe(false);
    expect((await getOwnedExperiment(db, ownerId, exp.id))?.name).toBe("Mine");
  });

  it("lets two accounts use the same slug", async () => {
    const { db, ownerId, otherId } = await seed();
    const a = await createExperiment(db, ownerId, { name: "Headlines", variants: twoWay });
    const b = await createExperiment(db, otherId, { name: "Headlines", variants: twoWay });
    expect(a.slug).toBe("headlines");
    expect(b.slug).toBe("headlines");
  });
});
