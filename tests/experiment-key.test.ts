import { describe, it, expect } from "vitest";
import { assignVariant, variantsSchema } from "@/lib/experiments";

/**
 * The experiment key identifies the page under test. It has to be an
 * identifier, not content: content gets edited, and an edited key is a
 * different page as far as the assignment is concerned.
 */
const twoWay = variantsSchema.parse([
  { id: "a", label: "A", weight: 1, params: {} },
  { id: "b", label: "B", weight: 1, params: {} },
]);

describe("why a title cannot be the key", () => {
  it("a one-character edit re-randomises about half the time", () => {
    // This is the reason the render endpoint refuses to fall back to the
    // title: fixing a typo would silently move roughly half of affected
    // pages into the other arm.
    let flipped = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const before = `My awsome post number ${i}`;
      const after = before.replace("awsome", "awesome");
      if (
        assignVariant("t", before, twoWay)!.id !==
        assignVariant("t", after, twoWay)!.id
      ) {
        flipped += 1;
      }
    }
    expect(flipped / n).toBeGreaterThan(0.35);
    expect(flipped / n).toBeLessThan(0.65);
  });
});

describe("what a stable key gives you", () => {
  it("survives every edit to the page's content", () => {
    // The card can be rewritten freely; the key is what pins the page.
    const key = "post-123";
    const first = assignVariant("headline-test", key, twoWay)!.id;
    // The headline changes three times; the key, and so the variant, does not.
    for (let rewrite = 0; rewrite < 3; rewrite++) {
      expect(assignVariant("headline-test", key, twoWay)!.id).toBe(first);
    }
  });

  it("is unaffected by cache-busting the card", () => {
    // Bumping ?v= after a typo fix changes the image URL so platforms
    // refetch, but the key is separate, so the assignment stands.
    const first = assignVariant("headline-test", "post-123", twoWay)!.id;
    expect(assignVariant("headline-test", "post-123", twoWay)!.id).toBe(first);
  });

  it("treats a URL as stable, since a URL identifies a page", () => {
    const url = "https://example.com/blog/my-post";
    const first = assignVariant("t", url, twoWay)!.id;
    expect(assignVariant("t", url, twoWay)!.id).toBe(first);
    // A genuinely different URL is a genuinely different page.
    expect(assignVariant("t", `${url}-2`, twoWay)).not.toBeNull();
  });
});
