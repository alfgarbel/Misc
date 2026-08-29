import { fetchHtml, FETCH_MESSAGES, type FetchResult } from "../urlcard/fetch";
import {
  extractCardTags,
  extractMetadata,
  type CardTags,
  type PageMetadata,
} from "../urlcard/extract";
import { normalizeUrl } from "../urlcard";
import { inspectImage, type ImageInspection } from "./image";
import { diagnose, type Diagnosis } from "./diagnose";

export interface CardReport {
  ok: true;
  /** The URL we ended up at, after redirects. */
  pageUrl: string;
  meta: PageMetadata;
  tags: CardTags;
  image: ImageInspection | null;
  diagnosis: Diagnosis;
  /** True when this came from the cache rather than a fresh fetch. */
  cached: boolean;
}

export interface CardReportError {
  ok: false;
  message: string;
}

export type CardReportResult = CardReport | CardReportError;

/**
 * Reports are cached in memory rather than in the database.
 *
 * The checker is public, so a link on Hacker News means thousands of people
 * checking the same handful of URLs within minutes. Reading someone else's
 * server once and reusing the answer is the polite version of that, and
 * five minutes is short enough that fixing your tags and re-checking shows
 * the fix.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 256;
const cache = new Map<string, { report: CardReport; at: number }>();

/** Tests only, so one case can't see another's cached report. */
export function clearReportCache() {
  cache.clear();
}

function remember(key: string, report: CardReport, at: number): CardReport {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { report, at });
  return report;
}

/**
 * A report already in the cache, or null.
 *
 * Split out so the page can answer a repeat check without spending the
 * caller's rate limit: the limit exists to stop us hammering other
 * people's servers, and a cache hit touches nobody. Without this, a link
 * doing the rounds on Hacker News throttles the very people arriving to
 * look at it.
 */
export function cachedReport(
  rawUrl: string,
  now: number = Date.now()
): CardReport | null {
  const url = normalizeUrl(rawUrl);
  if (!url) return null;
  const hit = cache.get(url);
  if (!hit || now - hit.at >= CACHE_TTL_MS) return null;
  return { ...hit.report, cached: true };
}

/**
 * Turns a fetch failure into something the reader can act on.
 *
 * Blocked-crawler responses need saying out loud: plenty of sites serve
 * 403 to anything that isn't a browser or a name-brand crawler, and that
 * is not evidence of a broken card.
 */
export function fetchFailureMessage(err: {
  reason: keyof typeof FETCH_MESSAGES;
  status?: number;
}): string {
  if (err.reason !== "http_error" || err.status === undefined) {
    return FETCH_MESSAGES[err.reason];
  }
  if (err.status === 401 || err.status === 403) {
    return `That site refused our reader (HTTP ${err.status}). Many sites allow Facebook's and X's crawlers but block everything else, so your card may well be fine — we just can't see it from here.`;
  }
  if (err.status === 404 || err.status === 410) {
    return `That page returned HTTP ${err.status}. Check the URL.`;
  }
  if (err.status === 429) {
    return "That site is rate-limiting us (HTTP 429). Try again shortly.";
  }
  if (err.status >= 500) {
    return `That site returned HTTP ${err.status}, so it's having trouble of its own right now.`;
  }
  return `That page returned HTTP ${err.status}.`;
}

export async function checkUrl(
  rawUrl: string,
  /** Seams for tests, which need a reachable origin. */
  deps: {
    fetchPage?: (url: string) => Promise<FetchResult>;
    inspect?: (url: string) => Promise<ImageInspection>;
    now?: () => number;
  } = {}
): Promise<CardReportResult> {
  const fetchPage = deps.fetchPage ?? fetchHtml;
  const inspect = deps.inspect ?? inspectImage;
  const now = deps.now ?? Date.now;

  const url = normalizeUrl(rawUrl);
  if (!url) return { ok: false, message: FETCH_MESSAGES.bad_url };

  const hit = cachedReport(url, now());
  if (hit) return hit;

  const res = await fetchPage(url);
  if (!res.ok) return { ok: false, message: fetchFailureMessage(res) };

  const html = res.body.toString("utf8");
  const tags = extractCardTags(html);
  const meta = extractMetadata(html, res.finalUrl);

  // Only the og:image is inspected. twitter:image is reported on as a tag,
  // but a page whose only image is the X one is already broken everywhere
  // else, and fetching it wouldn't change that finding.
  const image = meta.imageUrl && tags.ogImage ? await inspect(meta.imageUrl) : null;

  const report: CardReport = {
    ok: true,
    pageUrl: res.finalUrl,
    meta,
    tags,
    image,
    diagnosis: diagnose({
      pageUrl: res.finalUrl,
      tags,
      imageUrl: meta.imageUrl,
      image,
    }),
    cached: false,
  };
  return remember(url, report, now());
}
