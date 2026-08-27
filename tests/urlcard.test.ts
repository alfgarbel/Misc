import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers";
import { urlCache } from "@/lib/db/schema";
import type { Database } from "@/lib/db";
import { checkUrl } from "@/lib/urlcard/safety";
import { safeFetch, type FetchFailure, type FetchResult } from "@/lib/urlcard/fetch";
import {
  applyUrlMetadata,
  getUrlMetadata,
  normalizeUrl,
  CACHE_TTL_MS,
} from "@/lib/urlcard";

let server: Server;
let origin: string;
let hits = 0;

beforeAll(async () => {
  server = createServer((req, res) => {
    hits += 1;
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/post") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html><head>
        <title>Fallback</title>
        <meta property="og:title" content="How we cut render time by 90%">
        <meta property="og:description" content="A deep dive into satori.">
        <meta property="og:site_name" content="Example Engineering">
        <meta property="og:image" content="/card.png">
      </head><body>x</body></html>`);
    } else if (path === "/bare") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><head><title>Just a title</title></head><body></body></html>");
    } else if (path === "/gone") {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("nope");
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  hits = 0;
});

/** Allows the test origin; every other URL is judged by the real guard. */
const testFetch = (url: string): Promise<FetchResult> =>
  safeFetch(url, {
    maxBytes: 512 * 1024,
    expect: (ct) => ct.includes("text/html") || ct === "",
    check: async (u): Promise<{ ok: boolean; reason?: FetchFailure }> => {
      if (u.startsWith(origin)) return { ok: true };
      const r = await checkUrl(u);
      return { ok: r.ok, reason: r.reason };
    },
  });

describe("normalizeUrl", () => {
  it("drops the fragment, which is never sent to the server", () => {
    expect(normalizeUrl("https://example.com/a#section")).toBe("https://example.com/a");
  });

  it("drops a default port but keeps a non-default one", () => {
    expect(normalizeUrl("https://example.com:443/a")).toBe("https://example.com/a");
    expect(normalizeUrl("http://example.com:80/a")).toBe("http://example.com/a");
    expect(normalizeUrl("https://example.com:8443/a")).toBe("https://example.com:8443/a");
  });

  it("preserves the query string, which changes what a page serves", () => {
    expect(normalizeUrl("https://example.com/p?id=2")).toBe("https://example.com/p?id=2");
  });

  it("returns null for something that isn't a URL", () => {
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("getUrlMetadata", () => {
  let db: Database;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("reads a page and returns its card fields", async () => {
    const r = await getUrlMetadata(db, `${origin}/post`, new Date(), testFetch);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meta.title).toBe("How we cut render time by 90%");
    expect(r.meta.description).toBe("A deep dive into satori.");
    expect(r.meta.siteName).toBe("Example Engineering");
    expect(r.meta.imageUrl).toBe(`${origin}/card.png`);
    expect(r.cached).toBe(false);
  });

  it("serves the second request from cache without touching the site", async () => {
    await getUrlMetadata(db, `${origin}/post`, new Date(), testFetch);
    expect(hits).toBe(1);
    const second = await getUrlMetadata(db, `${origin}/post`, new Date(), testFetch);
    expect(hits).toBe(1);
    expect(second.ok && second.cached).toBe(true);
  });

  it("refetches once the cached copy is stale", async () => {
    const t0 = new Date("2026-08-27T00:00:00Z");
    await getUrlMetadata(db, `${origin}/post`, t0, testFetch);
    const later = new Date(t0.getTime() + CACHE_TTL_MS + 1000);
    await getUrlMetadata(db, `${origin}/post`, later, testFetch);
    expect(hits).toBe(2);
  });

  it("treats URLs differing only by fragment as the same page", async () => {
    await getUrlMetadata(db, `${origin}/post`, new Date(), testFetch);
    await getUrlMetadata(db, `${origin}/post#comments`, new Date(), testFetch);
    expect(hits).toBe(1);
  });

  it("stores one row per normalised URL", async () => {
    await getUrlMetadata(db, `${origin}/post`, new Date(), testFetch);
    await getUrlMetadata(db, `${origin}/post`, new Date(), testFetch);
    const rows = await db.select().from(urlCache);
    expect(rows).toHaveLength(1);
  });

  it("falls back to a stale copy when the site has gone down", async () => {
    const t0 = new Date("2026-08-27T00:00:00Z");
    await getUrlMetadata(db, `${origin}/post`, t0, testFetch);
    const dead = async (): Promise<FetchResult> => ({ ok: false, reason: "network" });
    const later = new Date(t0.getTime() + CACHE_TTL_MS + 1000);
    const r = await getUrlMetadata(db, `${origin}/post`, later, dead);
    // A slightly old card beats no card at all.
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.meta.title).toBe("How we cut render time by 90%");
  });

  it("reports a failure when there is nothing cached to fall back on", async () => {
    const r = await getUrlMetadata(db, `${origin}/gone`, new Date(), testFetch);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("http_error");
  });

  it("refuses a URL the guard blocks, with no injected fetcher", async () => {
    const r = await getUrlMetadata(db, "http://169.254.169.254/latest/meta-data/");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("blocked_address");
      // The caller learns nothing about our internal network.
      expect(r.message).not.toContain("169.254");
    }
  });

  it("copes with a page carrying almost no metadata", async () => {
    const r = await getUrlMetadata(db, `${origin}/bare`, new Date(), testFetch);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.meta.title).toBe("Just a title");
      expect(r.meta.description).toBeNull();
      expect(r.meta.domain).toBe("127.0.0.1");
    }
  });

  it("updates the stored row on refetch rather than duplicating it", async () => {
    const t0 = new Date("2026-08-27T00:00:00Z");
    await getUrlMetadata(db, `${origin}/post`, t0, testFetch);
    const later = new Date(t0.getTime() + CACHE_TTL_MS + 1000);
    await getUrlMetadata(db, `${origin}/post`, later, testFetch);
    const rows = await db
      .select()
      .from(urlCache)
      .where(eq(urlCache.url, `${origin}/post`));
    expect(rows).toHaveLength(1);
    expect(rows[0].fetchedAt.getTime()).toBe(later.getTime());
  });
});

describe("applyUrlMetadata", () => {
  const meta = {
    title: "Scraped title",
    description: "Scraped description",
    siteName: "Scraped Site",
    imageUrl: null,
    domain: "example.com",
    url: "https://example.com/p",
  };

  it("fills in what the caller didn't say", () => {
    const out = applyUrlMetadata(new URLSearchParams(), meta);
    expect(out.get("title")).toBe("Scraped title");
    expect(out.get("subtitle")).toBe("Scraped description");
    expect(out.get("site")).toBe("Scraped Site");
  });

  it("never overrides what the caller did say", () => {
    const out = applyUrlMetadata(new URLSearchParams({ title: "Mine" }), meta);
    expect(out.get("title")).toBe("Mine");
    expect(out.get("subtitle")).toBe("Scraped description");
  });

  it("falls back to the domain when the page names no site", () => {
    const out = applyUrlMetadata(new URLSearchParams(), { ...meta, siteName: null });
    expect(out.get("site")).toBe("example.com");
  });

  it("exposes extra fields for custom template placeholders", () => {
    const out = applyUrlMetadata(new URLSearchParams(), meta);
    expect(out.get("domain")).toBe("example.com");
    expect(out.get("description")).toBe("Scraped description");
  });

  it("leaves the caller's params untouched", () => {
    const original = new URLSearchParams({ title: "Mine" });
    applyUrlMetadata(original, meta);
    expect(original.get("subtitle")).toBeNull();
  });
});
