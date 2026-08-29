import { describe, it, expect, beforeEach } from "vitest";
import { diagnose, type DiagnoseInput } from "@/lib/checker/diagnose";
import {
  cachedReport,
  checkUrl,
  clearReportCache,
  fetchFailureMessage,
} from "@/lib/checker/report";
import { extractCardTags } from "@/lib/urlcard/extract";
import { coerceUrl } from "@/lib/checker/url";
import type { ImageInspection } from "@/lib/checker/image";
import { FETCH_MESSAGES, type FetchResult } from "@/lib/urlcard/fetch";

const emptyTags = extractCardTags("<html><head></head></html>");

/** A page that does everything right, as the baseline to break one rule at a time. */
function healthy(): DiagnoseInput {
  const html = `<html><head>
    <title>Ships fast</title>
    <meta property="og:title" content="Ships fast">
    <meta property="og:description" content="A short line for a feed.">
    <meta property="og:image" content="https://example.com/card.png">
    <meta property="og:url" content="https://example.com/post">
    <meta name="twitter:card" content="summary_large_image">
  </head></html>`;
  return {
    pageUrl: "https://example.com/post",
    tags: extractCardTags(html),
    imageUrl: "https://example.com/card.png",
    image: { ok: true, mimeType: "image/png", bytes: 90_000, width: 1200, height: 630 },
  };
}

const ids = (i: DiagnoseInput) => diagnose(i).findings.map((f) => f.id);

describe("a page with nothing wrong", () => {
  it("reports no findings and says so", () => {
    const d = diagnose(healthy());
    expect(d.findings).toEqual([]);
    expect(d.verdict).toBe("good");
  });

  it("still lists what passed, so the result isn't a blank page", () => {
    expect(diagnose(healthy()).passed.length).toBeGreaterThan(3);
  });
});

describe("finding the image", () => {
  it("calls a page with no image at all broken", () => {
    const d = diagnose({ ...healthy(), tags: emptyTags, imageUrl: null, image: null });
    expect(d.findings.map((f) => f.id)).toContain("no-image");
    expect(d.verdict).toBe("broken");
  });

  it("treats a twitter-only image as broken, not merely degraded", () => {
    const tags = extractCardTags(
      '<head><meta name="twitter:image" content="https://e.com/a.png"></head>'
    );
    const d = diagnose({ ...healthy(), tags, imageUrl: null, image: null });
    expect(d.findings.find((f) => f.id === "twitter-image-only")?.severity).toBe("error");
  });

  it("flags a relative og:image", () => {
    const tags = extractCardTags('<head><meta property="og:image" content="/card.png"></head>');
    expect(ids({ ...healthy(), tags })).toContain("relative-image");
  });

  it("flags http image on an https page, and not the other way round", () => {
    const tags = extractCardTags(
      '<head><meta property="og:image" content="http://e.com/a.png"></head>'
    );
    expect(ids({ ...healthy(), tags, imageUrl: "http://e.com/a.png" })).toContain(
      "insecure-image"
    );
    expect(
      ids({
        ...healthy(),
        pageUrl: "http://e.com/post",
        tags,
        imageUrl: "http://e.com/a.png",
      })
    ).not.toContain("insecure-image");
  });
});

describe("image faults", () => {
  const fault = (image: ImageInspection) => diagnose({ ...healthy(), image });

  it("treats an unreachable image as an error", () => {
    const d = fault({ ok: false, fault: "unreachable", detail: "404" });
    expect(d.findings.find((f) => f.id === "image-unreachable")?.severity).toBe("error");
  });

  it("treats an SVG as a warning, not a failure to load", () => {
    const d = fault({ ok: false, fault: "unsupported_format", detail: "svg" });
    expect(d.findings.find((f) => f.id === "image-unsupported_format")?.severity).toBe(
      "warning"
    );
  });
});

describe("image dimensions", () => {
  const sized = (width: number, height: number) =>
    ids({
      ...healthy(),
      image: { ok: true, mimeType: "image/png", bytes: 1000, width, height },
    });

  it("calls anything under 200x200 invisible", () => {
    expect(sized(180, 180)).toContain("image-tiny");
  });

  it("warns between the floor and the large-card threshold", () => {
    expect(sized(400, 300)).toContain("image-small");
    expect(sized(400, 300)).not.toContain("image-tiny");
  });

  it("only notes softness once the image is otherwise fine", () => {
    expect(sized(800, 420)).toContain("image-soft");
    expect(sized(1200, 630)).not.toContain("image-soft");
  });

  it("flags a square image as croppable and a wide banner as letterboxed", () => {
    expect(sized(1000, 1000)).toContain("image-aspect-tall");
    expect(sized(2800, 800)).toContain("image-aspect-wide");
    expect(sized(1200, 630)).not.toContain("image-aspect-tall");
  });

  it("does not double-report shape on an image already too small to appear", () => {
    // 100x100 is square, but "it's invisible" is the only useful finding.
    expect(sized(100, 100)).toContain("image-tiny");
    expect(sized(100, 100)).not.toContain("image-aspect-tall");
  });

  it("catches declared dimensions that disagree with the real file", () => {
    const tags = extractCardTags(`<head>
      <meta property="og:image" content="https://e.com/a.png">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="630">
    </head>`);
    const mismatch = ids({
      ...healthy(),
      tags,
      image: { ok: true, mimeType: "image/png", bytes: 1, width: 600, height: 315 },
    });
    expect(mismatch).toContain("declared-size-mismatch");

    const agrees = ids({
      ...healthy(),
      tags,
      image: { ok: true, mimeType: "image/png", bytes: 1, width: 1200, height: 630 },
    });
    expect(agrees).not.toContain("declared-size-mismatch");
  });
});

describe("text and X tags", () => {
  it("distinguishes no title at all from only a <title>", () => {
    expect(ids({ ...healthy(), tags: emptyTags })).toContain("no-title");
    const onlyTitle = extractCardTags("<head><title>Search-engine flavoured title</title></head>");
    const found = ids({ ...healthy(), tags: onlyTitle });
    expect(found).toContain("no-og-title");
    expect(found).not.toContain("no-title");
  });

  it("softens the missing-description finding when a meta description exists", () => {
    const withMeta = extractCardTags(
      '<head><meta property="og:image" content="https://e.com/a.png"><meta name="description" content="Fallback."></head>'
    );
    const without = extractCardTags(
      '<head><meta property="og:image" content="https://e.com/a.png"></head>'
    );
    const sev = (t: typeof withMeta) =>
      diagnose({ ...healthy(), tags: t }).findings.find((f) => f.id === "no-og-description")
        ?.severity;
    expect(sev(withMeta)).toBe("note");
    expect(sev(without)).toBe("warning");
  });

  it("flags a summary card that wastes a wide image", () => {
    const tags = extractCardTags(`<head>
      <meta property="og:image" content="https://e.com/a.png">
      <meta name="twitter:card" content="summary">
    </head>`);
    expect(ids({ ...healthy(), tags })).toContain("twitter-card-summary");
  });

  it("does not flag summary when the image is too small for a large card anyway", () => {
    const tags = extractCardTags(`<head>
      <meta property="og:image" content="https://e.com/a.png">
      <meta name="twitter:card" content="summary">
    </head>`);
    const found = ids({
      ...healthy(),
      tags,
      image: { ok: true, mimeType: "image/png", bytes: 1, width: 300, height: 300 },
    });
    expect(found).not.toContain("twitter-card-summary");
  });
});

describe("verdict", () => {
  it("is degraded when there are warnings but nothing fatal", () => {
    const tags = extractCardTags(
      '<head><title>T</title><meta property="og:image" content="https://e.com/a.png"><meta property="og:title" content="T"><meta property="og:url" content="https://e.com/"></head>'
    );
    const d = diagnose({ ...healthy(), tags });
    expect(d.verdict).toBe("degraded");
    expect(d.findings.every((f) => f.severity !== "error")).toBe(true);
  });

  it("lists errors before warnings before notes", () => {
    const d = diagnose({ ...healthy(), tags: emptyTags, imageUrl: null, image: null });
    const rank = { error: 0, warning: 1, note: 2 };
    const seen = d.findings.map((f) => rank[f.severity]);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
});

describe("checkUrl", () => {
  beforeEach(() => clearReportCache());

  const page = (html: string): FetchResult => ({
    ok: true,
    finalUrl: "https://example.com/post",
    contentType: "text/html",
    body: Buffer.from(html),
  });

  it("rejects something that isn't a URL without reaching the network", async () => {
    let called = false;
    const res = await checkUrl("not a url", {
      fetchPage: async () => {
        called = true;
        return page("");
      },
    });
    expect(res.ok).toBe(false);
    expect(called).toBe(false);
  });

  it("reads the page and reports on it", async () => {
    const res = await checkUrl("https://example.com/post", {
      fetchPage: async () =>
        page(
          '<head><title>A search-engine flavoured title</title><meta property="og:image" content="https://e.com/a.png"></head>'
        ),
      inspect: async () => ({ ok: true, mimeType: "image/png", bytes: 10, width: 1200, height: 630 }),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.diagnosis.findings.map((f) => f.id)).toContain("no-og-title");
    expect(res.cached).toBe(false);
  });

  it("serves a repeat check from cache without refetching", async () => {
    let fetches = 0;
    const deps = {
      fetchPage: async () => {
        fetches++;
        return page('<head><meta property="og:image" content="https://e.com/a.png"></head>');
      },
      inspect: async (): Promise<ImageInspection> => ({
        ok: true, mimeType: "image/png", bytes: 10, width: 1200, height: 630,
      }),
    };
    await checkUrl("https://example.com/post", deps);
    const second = await checkUrl("https://example.com/post", deps);
    expect(fetches).toBe(1);
    expect(second.ok && second.cached).toBe(true);
  });

  it("refetches once the cache entry is stale", async () => {
    let fetches = 0;
    let clock = 1_000_000;
    const deps = {
      fetchPage: async () => {
        fetches++;
        return page('<head><meta property="og:image" content="https://e.com/a.png"></head>');
      },
      inspect: async (): Promise<ImageInspection> => ({
        ok: true, mimeType: "image/png", bytes: 10, width: 1200, height: 630,
      }),
      now: () => clock,
    };
    await checkUrl("https://example.com/post", deps);
    clock += 6 * 60 * 1000;
    await checkUrl("https://example.com/post", deps);
    expect(fetches).toBe(2);
  });

  it("does not fetch an image when the page declares none", async () => {
    let inspected = false;
    await checkUrl("https://example.com/post", {
      fetchPage: async () => page("<head><title>Bare</title></head>"),
      inspect: async () => {
        inspected = true;
        return { ok: true, mimeType: "image/png", bytes: 1, width: 1, height: 1 };
      },
    });
    expect(inspected).toBe(false);
  });
});

describe("cachedReport", () => {
  beforeEach(() => clearReportCache());

  const page = (html: string): FetchResult => ({
    ok: true,
    finalUrl: "https://example.com/post",
    contentType: "text/html",
    body: Buffer.from(html),
  });

  const deps = {
    fetchPage: async () => page('<head><title>T</title><meta property="og:image" content="https://e.com/a.png"></head>'),
    inspect: async (): Promise<ImageInspection> => ({
      ok: true, mimeType: "image/png", bytes: 10, width: 1200, height: 630,
    }),
  };

  it("is null before anything has been checked", () => {
    expect(cachedReport("https://example.com/post")).toBeNull();
  });

  it("returns the stored report afterwards, marked cached", async () => {
    await checkUrl("https://example.com/post", deps);
    const hit = cachedReport("https://example.com/post");
    expect(hit?.cached).toBe(true);
    expect(hit?.pageUrl).toBe("https://example.com/post");
  });

  it("matches the same page written a trivially different way", async () => {
    await checkUrl("https://example.com/post", deps);
    // The fragment never reaches the server, so it's the same request.
    expect(cachedReport("https://example.com/post#intro")).not.toBeNull();
  });

  it("is null once the entry is stale, so the limit applies again", async () => {
    await checkUrl("https://example.com/post", deps);
    expect(cachedReport("https://example.com/post", Date.now() + 6 * 60 * 1000)).toBeNull();
  });

  it("is null for a URL that isn't one, rather than throwing", () => {
    expect(cachedReport("not a url")).toBeNull();
  });
});

describe("fetch failure messages", () => {
  it("says a blocked crawler is not proof the card is broken", () => {
    const m = fetchFailureMessage({ reason: "http_error", status: 403 });
    expect(m).toContain("403");
    // The important half: don't tell someone their card is broken when all
    // we know is that we personally were refused.
    expect(m).toMatch(/may well be fine/i);
  });

  it("distinguishes the statuses that mean different things", () => {
    expect(fetchFailureMessage({ reason: "http_error", status: 404 })).toContain("404");
    expect(fetchFailureMessage({ reason: "http_error", status: 429 })).toMatch(/rate-limit/i);
    expect(fetchFailureMessage({ reason: "http_error", status: 503 })).toContain("503");
  });

  it("falls back to the generic wording when there's no status", () => {
    expect(fetchFailureMessage({ reason: "timeout" })).toBe(FETCH_MESSAGES.timeout);
    expect(fetchFailureMessage({ reason: "http_error" })).toBe(FETCH_MESSAGES.http_error);
  });

  it("is used by checkUrl, not just available to it", async () => {
    clearReportCache();
    const res = await checkUrl("https://example.com/gone", {
      fetchPage: async () => ({ ok: false, reason: "http_error", status: 403 }),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toContain("403");
  });
});

describe("coerceUrl", () => {
  it("accepts a bare domain, which is what people actually type", () => {
    expect(coerceUrl("ogsmith.app")).toBe("https://ogsmith.app/");
    expect(coerceUrl("www.bbc.co.uk/news")).toBe("https://www.bbc.co.uk/news");
  });

  it("leaves a URL that already has a scheme alone", () => {
    expect(coerceUrl("http://ogsmith.app")).toBe("http://ogsmith.app/");
    expect(coerceUrl("https://ogsmith.app/check?url=x")).toBe(
      "https://ogsmith.app/check?url=x"
    );
  });

  it("handles the wrappers a pasted link arrives in", () => {
    expect(coerceUrl("  https://a.com/b  ")).toBe("https://a.com/b");
    expect(coerceUrl("<https://a.com/b>")).toBe("https://a.com/b");
    expect(coerceUrl('"a.com"')).toBe("https://a.com/");
    expect(coerceUrl("//a.com/b")).toBe("https://a.com/b");
  });

  it("refuses to invent a host out of a bare word", () => {
    // https://banana would resolve to nothing and produce a worse error.
    expect(coerceUrl("banana")).toBeNull();
    expect(coerceUrl("hello world")).toBeNull();
    expect(coerceUrl("")).toBeNull();
  });

  it("refuses schemes that aren't the web", () => {
    expect(coerceUrl("file:///etc/passwd")).toBeNull();
    expect(coerceUrl("javascript:alert(1)")).toBeNull();
    expect(coerceUrl("mailto:a@b.com")).toBeNull();
    expect(coerceUrl("ftp://a.com/")).toBeNull();
  });

  it("passes internal-looking hosts through for the guard to refuse", () => {
    // Rejecting them here would give a vaguer message than the SSRF guard's.
    expect(coerceUrl("localhost:3000")).toBe("https://localhost:3000/");
    expect(coerceUrl("192.168.1.1")).toBe("https://192.168.1.1/");
  });
});
