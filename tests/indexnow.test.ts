import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  indexNowPayloads,
  sitemapLocs,
  submitIndexNow,
} from "@/lib/indexnow";

const base = "https://ogsmith.example";

describe("IndexNow", () => {
  it("serves the key file from public/", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
    const file = readFileSync(new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url), "utf8");
    expect(file.trim()).toBe(INDEXNOW_KEY);
  });

  it("reads every <loc> from a sitemap", () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>${base}/</loc></url>` +
      `<url><loc>\n  ${base}/blog/a?x=1&amp;y=2\n</loc><lastmod>2026-01-01</lastmod></url></urlset>`;
    expect(sitemapLocs(xml)).toEqual([`${base}/`, `${base}/blog/a?x=1&y=2`]);
  });

  it("keeps only this host's URLs, deduplicated", () => {
    const [p, ...rest] = indexNowPayloads(base, [
      `${base}/a`,
      `${base}/a`,
      "https://elsewhere.example/b",
      "not a url",
      `${base}/c`,
    ]);
    expect(rest).toEqual([]);
    expect(p).toEqual({
      host: "ogsmith.example",
      key: INDEXNOW_KEY,
      keyLocation: `${base}/${INDEXNOW_KEY}.txt`,
      urlList: [`${base}/a`, `${base}/c`],
    });
  });

  it("splits into chunks of 10,000 and sends nothing for no URLs", () => {
    const urls = Array.from({ length: 10_001 }, (_, i) => `${base}/p/${i}`);
    expect(indexNowPayloads(base, urls).map((p) => p.urlList.length)).toEqual([10_000, 1]);
    expect(indexNowPayloads(base, [])).toEqual([]);
  });

  it("POSTs the payload as JSON", async () => {
    const calls: [string, RequestInit][] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(null, { status: 202 });
    }) as unknown as typeof fetch;
    expect(await submitIndexNow(base, [`${base}/a`], fake)).toEqual([{ urls: 1, status: 202, body: "" }]);
    expect(calls[0][0]).toBe(INDEXNOW_ENDPOINT);
    expect(calls[0][1].method).toBe("POST");
    expect(JSON.parse(calls[0][1].body as string).urlList).toEqual([`${base}/a`]);
  });
});
