import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import {
  applyDetectedBrand,
  brandIsUntouched,
  detectBrand,
  extractBrandHints,
  normalizeHex,
  sniffImageType,
  toLogoDataUrl,
  usableAccent,
} from "@/lib/brand-detect";
import type { FetchResult } from "@/lib/urlcard/fetch";
import { createTestDb } from "./helpers";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);

const page = (head: string) => `<html><head>${head}</head><body>ignored</body></html>`;

describe("brand hints from a page", () => {
  it("reads the site name, theme colour and touch icon", () => {
    const hints = extractBrandHints(
      page(
        `<meta property="og:site_name" content="Acme &amp; Co">` +
          `<meta name="theme-color" content="#E11D48">` +
          `<link rel="icon" href="/favicon-32.png" sizes="32x32">` +
          `<link rel="apple-touch-icon" href="/touch.png" sizes="180x180">`
      ),
      "https://acme.test/blog/post"
    );
    expect(hints.site).toBe("Acme & Co");
    expect(hints.accent).toBe("#e11d48");
    expect(hints.logoCandidates[0]).toBe("https://acme.test/touch.png");
    expect(hints.logoCandidates).toContain("https://acme.test/favicon-32.png");
  });

  it("falls back to the domain and skips white, black and grey theme colours", () => {
    const hints = extractBrandHints(
      page(`<meta name="theme-color" content="#ffffff"><link rel="mask-icon" href="/m.svg" color="#5bbad5">`),
      "https://www.example.org/"
    );
    expect(hints.site).toBe("example.org");
    expect(hints.accent).toBe("#5bbad5");
    expect(usableAccent("#000000")).toBe(false);
    expect(usableAccent("#808080")).toBe(false);
    expect(usableAccent("#6366f1")).toBe(true);
  });

  it("ignores SVG and ICO icons, which can't be stored as a logo", () => {
    const hints = extractBrandHints(
      page(`<link rel="icon" href="/favicon.ico"><link rel="icon" type="image/svg+xml" href="/i.svg">`),
      "https://x.test/"
    );
    expect(hints.logoCandidates).toEqual(["https://x.test/apple-touch-icon.png"]);
  });

  it("normalises hex and rejects other colour syntax", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("rgb(1,2,3)")).toBeNull();
    expect(normalizeHex(null)).toBeNull();
  });
});

describe("logo bytes", () => {
  it("trusts magic bytes, not the extension or content type", () => {
    expect(sniffImageType(PNG)).toBe("png");
    expect(sniffImageType(Buffer.from("<svg></svg>"))).toBeNull();
    expect(toLogoDataUrl(PNG)).toMatch(/^data:image\/png;base64,/);
    expect(toLogoDataUrl(Buffer.from("<svg></svg>"))).toBeNull();
  });

  it("drops icons too big to store", () => {
    expect(toLogoDataUrl(Buffer.concat([PNG, Buffer.alloc(100_000)]))).toBeNull();
  });
});

describe("detectBrand", () => {
  const ok = (body: string | Buffer, finalUrl: string): FetchResult => ({
    ok: true,
    finalUrl,
    contentType: "",
    body: Buffer.isBuffer(body) ? body : Buffer.from(body),
  });

  it("tries icons in order until one is a usable image", async () => {
    const tried: string[] = [];
    const detected = await detectBrand("https://acme.test", {
      html: async () =>
        ok(page(`<link rel="apple-touch-icon" href="/a.png"><link rel="icon" href="/b.png">`), "https://acme.test/"),
      image: async (url) => {
        tried.push(url);
        return url.endsWith("/a.png") ? { ok: false, reason: "http_error" } : ok(PNG, url);
      },
    });
    expect(tried.slice(0, 2)).toEqual(["https://acme.test/a.png", "https://acme.test/b.png"]);
    expect(detected?.logo).toMatch(/^data:image\/png/);
    expect(detected?.site).toBe("acme.test");
  });

  it("returns null when the page can't be read", async () => {
    const detected = await detectBrand("https://down.test", {
      html: async () => ({ ok: false, reason: "network" }),
      image: async () => ({ ok: false, reason: "network" }),
    });
    expect(detected).toBeNull();
  });
});

describe("applying a detected brand", () => {
  async function newUser(extra: Partial<typeof users.$inferInsert> = {}) {
    const db = await createTestDb();
    const id = `u-${Math.random().toString(36).slice(2)}`;
    await db.insert(users).values({ id, email: `${id}@t.dev`, passwordHash: "x", ...extra });
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return { db, user };
  }

  it("fills only empty fields and leaves the cache version alone", async () => {
    const { db, user } = await newUser({ brandSite: "Mine" });
    expect(brandIsUntouched(user)).toBe(false);
    const changed = await applyDetectedBrand(db, user, {
      site: "Theirs",
      accent: "#e11d48",
      logo: null,
    });
    expect(changed).toBe(true);
    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    expect(after.brandSite).toBe("Mine");
    expect(after.brandAccent).toBe("#e11d48");
    expect(after.brandUpdatedAt).toBeNull();
  });

  it("treats a fresh account as untouched, and a live one as not", async () => {
    const fresh = await newUser();
    expect(brandIsUntouched(fresh.user)).toBe(true);
    const live = await newUser({ liveAt: new Date() });
    expect(brandIsUntouched(live.user)).toBe(false);
  });
});
