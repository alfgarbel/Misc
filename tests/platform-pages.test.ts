import { describe, it, expect } from "vitest";
import { PLATFORM_PAGES, platformPage } from "@/lib/checker/platforms";
import sitemap from "@/app/sitemap";
import { llmsTxt } from "@/lib/llms";

describe("checker pages by platform", () => {
  it("have unique slugs and three questions each", () => {
    const slugs = PLATFORM_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of PLATFORM_PAGES) {
      expect(p.faq).toHaveLength(3);
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
    }
    expect(platformPage("twitter-card-validator")?.focus).toContain("x-large");
    expect(platformPage("nope")).toBeUndefined();
  });

  it("are listed in the sitemap and llms.txt", () => {
    const urls = sitemap().map((e) => e.url);
    const txt = llmsTxt("https://ogsmith.example");
    for (const p of PLATFORM_PAGES) {
      expect(urls.some((u) => u.endsWith(`/check/${p.slug}`))).toBe(true);
      expect(txt).toContain(`/check/${p.slug}`);
    }
  });
});
