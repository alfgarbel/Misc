import { describe, it, expect } from "vitest";
import {
  DEFAULT_SIZE,
  DESIGN_WIDTH,
  SIZES,
  SIZE_IDS,
  designCanvasOf,
  isPortrait,
  scaleFor,
  sizeOf,
} from "@/lib/og/sizes";
import { ogParamsSchema, parseOgParams } from "@/lib/og/params";
import { canvasOfSpec, starterSpec, templateSpecSchema } from "@/lib/og/spec";

describe("the size registry", () => {
  it("defaults to the Open Graph card", () => {
    expect(DEFAULT_SIZE).toBe("og");
    expect(SIZES.og.width).toBe(1200);
    expect(SIZES.og.height).toBe(630);
  });

  it("renders the default size through the unscaled path", () => {
    // scale 1 means no wrapper, which is what keeps existing cards
    // byte-for-byte identical to before sizes existed.
    expect(scaleFor(SIZES.og)).toBe(1);
    expect(designCanvasOf(SIZES.og)).toEqual({ width: 1200, height: 630 });
  });

  it("gives every size a usable definition", () => {
    for (const id of SIZE_IDS) {
      const s = SIZES[id];
      expect(s.width, id).toBeGreaterThan(0);
      expect(s.height, id).toBeGreaterThan(0);
      expect(s.designWidth, id).toBeGreaterThan(0);
      expect(s.label.length, id).toBeGreaterThan(0);
      expect(s.blurb.length, id).toBeGreaterThan(0);
    }
  });

  it("keeps every canvas within a sane rendering budget", () => {
    // A canvas is a memory allocation; presets exist so nobody can ask for
    // one big enough to matter.
    for (const id of SIZE_IDS) {
      expect(SIZES[id].width * SIZES[id].height, id).toBeLessThan(4_000_000);
    }
  });

  it("scales a design onto its canvas without distortion", () => {
    for (const id of SIZE_IDS) {
      const size = SIZES[id];
      const design = designCanvasOf(size);
      const scale = scaleFor(size);
      // The design, once scaled, is exactly the canvas.
      expect(Math.round(design.width * scale), id).toBe(size.width);
      expect(Math.abs(design.height * scale - size.height), id).toBeLessThan(2);
    }
  });

  it("uses a narrower design canvas for tall shapes, so type is bigger", () => {
    expect(SIZES.story.designWidth).toBeLessThan(DESIGN_WIDTH);
    expect(SIZES.square.designWidth).toBeLessThan(DESIGN_WIDTH);
    expect(SIZES.youtube.designWidth).toBe(DESIGN_WIDTH);
    expect(SIZES.wide.designWidth).toBe(DESIGN_WIDTH);
  });

  it("identifies the portrait shapes", () => {
    expect(isPortrait(SIZES.story)).toBe(true);
    expect(isPortrait(SIZES.og)).toBe(false);
    expect(isPortrait(SIZES.square)).toBe(false);
  });

  it("falls back to the default for a missing id", () => {
    expect(sizeOf(undefined)).toEqual(SIZES.og);
  });
});

describe("the size parameter", () => {
  it("defaults to og when not given", () => {
    expect(ogParamsSchema.parse({ title: "Hi" }).size).toBe("og");
  });

  it("accepts every registered size", () => {
    for (const id of SIZE_IDS) {
      const parsed = parseOgParams(new URLSearchParams({ title: "Hi", size: id }));
      expect(parsed.success, id).toBe(true);
      if (parsed.success) expect(parsed.data.size).toBe(id);
    }
  });

  it("rejects an unknown size rather than guessing one", () => {
    const parsed = parseOgParams(new URLSearchParams({ title: "Hi", size: "billboard" }));
    expect(parsed.success).toBe(false);
  });

  it("ignores an empty size, as it does every other blank parameter", () => {
    const parsed = parseOgParams(new URLSearchParams({ title: "Hi", size: "" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.size).toBe("og");
  });
});

describe("custom template canvases", () => {
  it("defaults a spec to the Open Graph canvas", () => {
    const spec = starterSpec();
    expect(spec.size).toBe("og");
    expect(canvasOfSpec(spec)).toEqual({ width: 1200, height: 630 });
  });

  it("reads the canvas from the spec, since layers are absolute", () => {
    const spec = templateSpecSchema.parse({
      version: 1,
      size: "story",
      background: { type: "solid", color: "#000000" },
      layers: [],
    });
    expect(canvasOfSpec(spec)).toEqual({ width: 1080, height: 1920 });
  });

  it("still parses a spec written before sizes existed", () => {
    // Stored rows predate the field; they must keep rendering as they were.
    const legacy = JSON.stringify({
      version: 1,
      background: { type: "solid", color: "#000000" },
      layers: [],
    });
    const parsed = templateSpecSchema.safeParse(JSON.parse(legacy));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(canvasOfSpec(parsed.data)).toEqual({ width: 1200, height: 630 });
  });

  it("rejects a canvas that isn't a known size", () => {
    const bad = {
      version: 1,
      size: "poster",
      background: { type: "solid", color: "#000000" },
      layers: [],
    };
    expect(templateSpecSchema.safeParse(bad).success).toBe(false);
  });

  it("allows layer coordinates that reach the tallest canvas", () => {
    const spec = templateSpecSchema.safeParse({
      version: 1,
      size: "story",
      background: { type: "solid", color: "#000000" },
      layers: [
        { id: "t", type: "text", text: "Bottom", x: 80, y: 1800, w: 900, fontSize: 40, color: "#ffffff" },
      ],
    });
    expect(spec.success).toBe(true);
  });
});
