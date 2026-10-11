import { describe, it, expect } from "vitest";
import { COMPARISONS, comparison } from "@/lib/compare";
import { PLANS } from "@/lib/plans";
import sitemap from "@/app/sitemap";
import { llmsTxt } from "@/lib/llms";

describe("comparison pages", () => {
  it("cite a source and quote our prices from PLANS", () => {
    const slugs = COMPARISONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of COMPARISONS) {
      expect(c.sources.length).toBeGreaterThan(0);
      for (const s of c.sources) expect(s.href).toMatch(/^https:\/\//);
      expect(c.rows.length).toBeGreaterThan(3);
    }
    const ours = JSON.stringify(comparison("bannerbear"));
    expect(ours).toContain(`$${PLANS.pro.priceMonthlyUsd}/month`);
    expect(ours).toContain(PLANS.pro.monthlyRenders.toLocaleString("en-US"));
    expect(comparison("nope")).toBeUndefined();
  });

  it("are listed in the sitemap and llms.txt", () => {
    const urls = sitemap().map((e) => e.url);
    const txt = llmsTxt("https://ogsmith.example");
    for (const c of COMPARISONS) {
      expect(urls.some((u) => u.endsWith(`/vs/${c.slug}`))).toBe(true);
      expect(txt).toContain(`/vs/${c.slug}`);
    }
  });
});
