import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { urlCache } from "../db/schema";
import {
  fetchHtml,
  FETCH_MESSAGES,
  type FetchFailure,
  type FetchResult,
} from "./fetch";
import { extractMetadata, type PageMetadata } from "./extract";

/** How long scraped metadata is reused before the page is read again. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Normalises a URL so trivially different spellings share a cache entry.
 * Deliberately conservative: only the fragment (never sent to the server)
 * and a default port are dropped. Query strings and trailing slashes can
 * change what a page serves, so they are preserved.
 */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    if (
      (u.protocol === "http:" && u.port === "80") ||
      (u.protocol === "https:" && u.port === "443")
    ) {
      u.port = "";
    }
    return u.toString();
  } catch {
    return null;
  }
}

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export type CardMetaResult =
  | { ok: true; meta: PageMetadata; cached: boolean }
  | { ok: false; reason: FetchFailure; message: string };

/**
 * Returns card metadata for a URL, reading the page only when there is no
 * fresh copy already stored.
 */
export async function getUrlMetadata(
  db: Database,
  rawUrl: string,
  now: Date = new Date(),
  /**
   * Seam for tests, which need a reachable origin. Production callers never
   * pass this, so the guarded fetcher is what runs.
   */
  fetcher: (url: string) => Promise<FetchResult> = fetchHtml
): Promise<CardMetaResult> {
  const url = normalizeUrl(rawUrl);
  if (!url) {
    return { ok: false, reason: "bad_url", message: FETCH_MESSAGES.bad_url };
  }
  const key = hashUrl(url);

  const cached = await db.query.urlCache.findFirst({
    where: eq(urlCache.urlHash, key),
  });
  if (cached && now.getTime() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return {
      ok: true,
      cached: true,
      meta: {
        title: cached.title,
        description: cached.description,
        siteName: cached.siteName,
        imageUrl: cached.imageUrl,
        domain: cached.domain,
        url: cached.url,
      },
    };
  }

  const res = await fetcher(url);
  if (!res.ok) {
    // A stale entry beats no card at all when a site is briefly down.
    if (cached) {
      return {
        ok: true,
        cached: true,
        meta: {
          title: cached.title,
          description: cached.description,
          siteName: cached.siteName,
          imageUrl: cached.imageUrl,
          domain: cached.domain,
          url: cached.url,
        },
      };
    }
    return {
      ok: false,
      reason: res.reason,
      message: FETCH_MESSAGES[res.reason],
    };
  }

  const meta = extractMetadata(res.body.toString("utf8"), res.finalUrl);
  const row = {
    urlHash: key,
    url: meta.url,
    title: meta.title,
    description: meta.description,
    siteName: meta.siteName,
    imageUrl: meta.imageUrl,
    domain: meta.domain,
    fetchedAt: now,
  };
  await db
    .insert(urlCache)
    .values(row)
    .onConflictDoUpdate({ target: urlCache.urlHash, set: row });

  return { ok: true, meta, cached: false };
}

/**
 * Folds scraped metadata into the request's parameters. Anything the caller
 * stated explicitly wins — ?url= is for filling in what you didn't say.
 */
export function applyUrlMetadata(
  params: URLSearchParams,
  meta: PageMetadata
): URLSearchParams {
  const merged = new URLSearchParams(params);
  const defaults: Record<string, string | null> = {
    title: meta.title,
    subtitle: meta.description,
    site: meta.siteName ?? meta.domain,
    // Also addressable from a custom template's {{placeholders}}.
    description: meta.description,
    domain: meta.domain,
    siteName: meta.siteName,
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (value && !merged.get(key)) merged.set(key, value);
  }
  return merged;
}

export type { PageMetadata };
