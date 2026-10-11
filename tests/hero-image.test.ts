import { describe, it, expect } from "vitest";
import { isCardUrl, loadHeroImage } from "@/lib/urlcard/image";

describe("a page's own image inside its card", () => {
  it("recognises an OGsmith card on any host", () => {
    expect(isCardUrl("https://ogsmith.app/api/og?key=og_x&url=https%3A%2F%2Fa.com")).toBe(true);
    expect(isCardUrl("https://preview.vercel.app/api/og?title=Hi")).toBe(true);
    expect(isCardUrl("https://a.com/images/cover.png")).toBe(false);
    expect(isCardUrl("not a url")).toBe(false);
  });

  it("never draws a card inside a card", async () => {
    // Would otherwise request this same card from inside itself.
    expect(await loadHeroImage("https://ogsmith.app/api/og?url=https%3A%2F%2Fa.com")).toBeNull();
  });
});
