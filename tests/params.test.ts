import { describe, it, expect } from "vitest";
import { parseOgParams } from "@/lib/og/params";

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
