/**
 * IndexNow tells Bing, Yandex, Seznam and the other participating engines
 * that a URL changed, instead of waiting for them to recrawl. The key is
 * public by design: engines prove ownership by fetching it from
 * /<key>.txt (see public/), so it lives in code rather than in an env var.
 */
export const INDEXNOW_KEY = "104a5d061150489f547064011dacbdb4";
// Bing shares every submission with the other IndexNow engines, and answers
// synchronously when the key can't be verified, so failures surface here.
export const INDEXNOW_ENDPOINT = "https://www.bing.com/indexnow";

// The protocol caps a single submission at 10,000 URLs.
const MAX_URLS = 10_000;

/** Every <loc> in a sitemap.xml, unescaped. */
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) =>
    m[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
  );
}

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

/**
 * The request bodies for a set of URLs on `base`. URLs on other hosts are
 * dropped (the engines reject the whole batch otherwise) and the rest are
 * deduplicated and split into protocol-sized chunks.
 */
export function indexNowPayloads(base: string, urls: string[]): IndexNowPayload[] {
  const origin = new URL(base);
  const own = [...new Set(urls)].filter((u) => {
    try {
      return new URL(u).host === origin.host;
    } catch {
      return false;
    }
  });
  const payloads: IndexNowPayload[] = [];
  for (let i = 0; i < own.length; i += MAX_URLS) {
    payloads.push({
      host: origin.host,
      key: INDEXNOW_KEY,
      keyLocation: `${origin.origin}/${INDEXNOW_KEY}.txt`,
      urlList: own.slice(i, i + MAX_URLS),
    });
  }
  return payloads;
}

export interface IndexNowResult {
  urls: number;
  status: number;
  body: string;
}

/** Submits the URLs and returns the engine's answer for each chunk. */
export async function submitIndexNow(
  base: string,
  urls: string[],
  fetchImpl: typeof fetch = fetch
): Promise<IndexNowResult[]> {
  const results: IndexNowResult[] = [];
  for (const payload of indexNowPayloads(base, urls)) {
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    results.push({ urls: payload.urlList.length, status: res.status, body: (await res.text()).slice(0, 500) });
  }
  return results;
}
