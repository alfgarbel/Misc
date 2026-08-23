import { describe, it, expect } from "vitest";
import { parseOgParams, applyBrandDefaults } from "@/lib/og/params";

function parse(qs: string) {
  return parseOgParams(new URLSearchParams(qs));
}

describe("og params", () => {
  it("applies defaults for an empty query", () => {
    const r = parse("");
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.template).toBe("gradient");
      expect(r.data.theme).toBe("dark");
      expect(r.data.accent).toBe("#6366f1");
      expect(r.data.title).toBe("Hello, world");
    }
  });

  it("accepts a full valid query", () => {
    const r = parse(
      "template=terminal&title=Deploy&subtitle=in%20seconds&site=x.dev&theme=light&accent=%23f43f5e"
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.template).toBe("terminal");
      expect(r.data.accent).toBe("#f43f5e");
      expect(r.data.subtitle).toBe("in seconds");
    }
  });

  it("rejects bad templates, themes, and colors", () => {
    expect(parse("template=fancy").success).toBe(false);
    expect(parse("theme=sepia").success).toBe(false);
    expect(parse("accent=red").success).toBe(false);
    expect(parse("accent=%23gggggg").success).toBe(false);
  });

  it("rejects oversized titles", () => {
    expect(parse(`title=${"a".repeat(201)}`).success).toBe(false);
    expect(parse(`title=${"a".repeat(200)}`).success).toBe(true);
  });

  it("accepts 3-digit hex accents", () => {
    const r = parse("accent=%23f43");
    expect(r.success).toBe(true);
  });
});

describe("brand defaults", () => {
  const defaults = {
    template: "split",
    theme: "light",
    accent: "#f43f5e",
    site: "acme.dev",
  };

  it("fills in missing fields only", () => {
    const merged = applyBrandDefaults(
      new URLSearchParams("title=Hello&theme=dark"),
      defaults
    );
    expect(merged.get("template")).toBe("split");
    expect(merged.get("theme")).toBe("dark"); // explicit param wins
    expect(merged.get("accent")).toBe("#f43f5e");
    expect(merged.get("site")).toBe("acme.dev");
    expect(merged.get("title")).toBe("Hello");
  });

  it("ignores null/empty defaults and leaves input untouched", () => {
    const input = new URLSearchParams("title=Hello");
    const merged = applyBrandDefaults(input, {
      template: null,
      theme: undefined,
      accent: "",
      site: null,
    });
    expect([...merged.entries()]).toEqual([["title", "Hello"]]);
    // Original params object is not mutated.
    expect(input.get("template")).toBeNull();
  });

  it("merged defaults still parse", () => {
    const merged = applyBrandDefaults(new URLSearchParams("title=Hi"), defaults);
    const r = parseOgParams(merged);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.template).toBe("split");
      expect(r.data.site).toBe("acme.dev");
    }
  });
});
