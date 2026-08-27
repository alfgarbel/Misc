import { describe, it, expect } from "vitest";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAX_LAYERS,
  MAX_PLACEHOLDER_LENGTH,
  fittedFontSize,
  parseSpec,
  resolvePlaceholders,
  specAssetIds,
  specPlaceholders,
  starterSpec,
  templateSpecSchema,
} from "@/lib/og/spec";

const textLayer = (over: Record<string, unknown> = {}) => ({
  id: "t",
  type: "text",
  text: "Hello",
  x: 0,
  y: 0,
  w: 600,
  fontSize: 48,
  color: "#ffffff",
  ...over,
});

const specWith = (layers: unknown[]) => ({
  version: 1,
  background: { type: "solid", color: "#000000" },
  layers,
});

describe("the canvas is fixed", () => {
  it("matches the Open Graph card size everything else assumes", () => {
    expect([CANVAS_WIDTH, CANVAS_HEIGHT]).toEqual([1200, 630]);
  });
});

describe("templateSpecSchema", () => {
  it("fills in the defaults a hand-written spec omits", () => {
    const parsed = templateSpecSchema.parse(specWith([textLayer()]));
    const layer = parsed.layers[0];
    expect(layer).toMatchObject({
      opacity: 1,
      rotate: 0,
      fontWeight: 400,
      align: "left",
      autoFit: true,
      fontFamily: "Inter",
      fontAssetId: null,
    });
  });

  it("accepts hex and rgba colours, and nothing else", () => {
    expect(templateSpecSchema.safeParse(specWith([textLayer({ color: "#fff" })])).success).toBe(true);
    expect(
      templateSpecSchema.safeParse(specWith([textLayer({ color: "rgba(255,255,255,0.5)" })])).success
    ).toBe(true);
    for (const bad of ["red", "url(x)", "expression(1)", "#12345", ""]) {
      expect(templateSpecSchema.safeParse(specWith([textLayer({ color: bad })])).success).toBe(false);
    }
  });

  it("caps the number of layers", () => {
    const many = Array.from({ length: MAX_LAYERS + 1 }, (_, i) => textLayer({ id: `t${i}` }));
    expect(templateSpecSchema.safeParse(specWith(many)).success).toBe(false);
  });

  it("has no way to name a remote URL", () => {
    // Images and fonts come from uploaded assets only; a spec that could
    // point at an arbitrary host would make the renderer fetch it.
    const withUrl = specWith([
      { id: "i", type: "image", x: 0, y: 0, w: 10, h: 10, src: "http://169.254.169.254/" },
    ]);
    expect(templateSpecSchema.safeParse(withUrl).success).toBe(false);
  });

  it("keeps layers on or near the canvas", () => {
    expect(templateSpecSchema.safeParse(specWith([textLayer({ x: -500 })])).success).toBe(true);
    expect(templateSpecSchema.safeParse(specWith([textLayer({ x: 99999 })])).success).toBe(false);
    expect(templateSpecSchema.safeParse(specWith([textLayer({ w: 0 })])).success).toBe(false);
  });

  it("rejects an unknown layer type", () => {
    expect(
      templateSpecSchema.safeParse(specWith([{ id: "v", type: "video", x: 0, y: 0 }])).success
    ).toBe(false);
  });
});

describe("parseSpec", () => {
  it("round-trips a valid stored spec", () => {
    const parsed = parseSpec(JSON.stringify(starterSpec()));
    expect(parsed.success).toBe(true);
  });

  it("explains bad JSON and bad shapes differently", () => {
    const a = parseSpec("{oops");
    const b = parseSpec('{"version":1,"layers":[]}');
    expect(a.success).toBe(false);
    expect(b.success).toBe(false);
    if (!a.success) expect(a.error).toMatch(/not valid JSON/);
    if (!b.success) expect(b.error).toMatch(/invalid/);
  });
});

describe("resolvePlaceholders", () => {
  it("substitutes values from the query string", () => {
    const params = new URLSearchParams({ title: "Hello", author: "Ada" });
    expect(resolvePlaceholders("{{title}} by {{author}}", params)).toBe("Hello by Ada");
  });

  it("tolerates whitespace inside the braces", () => {
    const params = new URLSearchParams({ title: "Hi" });
    expect(resolvePlaceholders("{{ title }}", params)).toBe("Hi");
  });

  it("blanks an unknown placeholder rather than showing the braces", () => {
    expect(resolvePlaceholders("{{nope}}!", new URLSearchParams())).toBe("!");
  });

  it("leaves non-placeholder braces alone", () => {
    expect(resolvePlaceholders("{ not } {{}}", new URLSearchParams())).toBe("{ not } {{}}");
  });

  it("bounds each value, so one parameter cannot blow up the render", () => {
    const params = new URLSearchParams({ title: "x".repeat(5000) });
    expect(resolvePlaceholders("{{title}}", params)).toHaveLength(MAX_PLACEHOLDER_LENGTH);
  });

  it("treats a value that looks like a placeholder as plain text", () => {
    const params = new URLSearchParams({ a: "{{b}}", b: "gotcha" });
    expect(resolvePlaceholders("{{a}}", params)).toBe("{{b}}");
  });
});

describe("specPlaceholders", () => {
  it("lists what a template expects, in first-seen order, without repeats", () => {
    const spec = templateSpecSchema.parse(
      specWith([
        textLayer({ id: "a", text: "{{title}} — {{site}}" }),
        textLayer({ id: "b", text: "{{title}} again" }),
      ])
    );
    expect(specPlaceholders(spec)).toEqual(["title", "site"]);
  });
});

describe("specAssetIds", () => {
  it("finds every asset a spec depends on, including fonts and backgrounds", () => {
    const spec = templateSpecSchema.parse({
      version: 1,
      background: { type: "image", assetId: "bg" },
      layers: [
        { id: "i", type: "image", x: 0, y: 0, w: 10, h: 10, assetId: "img" },
        textLayer({ id: "t", fontAssetId: "font" }),
      ],
    });
    expect(specAssetIds(spec).sort()).toEqual(["bg", "font", "img"]);
  });
});

describe("fittedFontSize", () => {
  const layer = { fontSize: 76, w: 1040, lineHeight: 1.1, autoFit: true };

  it("leaves text that fits at its designed size", () => {
    expect(fittedFontSize(layer, "A short headline")).toBe(76);
  });

  it("shrinks text that would overflow the box", () => {
    const long = "word ".repeat(80);
    const size = fittedFontSize(layer, long);
    expect(size).toBeLessThan(76);
    expect(size).toBeGreaterThanOrEqual(12);
  });

  it("honours the designer turning auto-fit off", () => {
    expect(fittedFontSize({ ...layer, autoFit: false }, "word ".repeat(80))).toBe(76);
  });

  it("never returns something unreadable, however long the text", () => {
    expect(fittedFontSize(layer, "x".repeat(100000))).toBeGreaterThanOrEqual(12);
  });

  it("handles empty text without dividing by zero", () => {
    expect(fittedFontSize(layer, "")).toBe(76);
  });
});
