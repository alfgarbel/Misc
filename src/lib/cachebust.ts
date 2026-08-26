import { eq, sql } from "drizzle-orm";
import type { Database } from "./db";
import { users } from "./db/schema";

/**
 * Social platforms and CDNs key their caches on the image URL alone. Nothing
 * about a re-render reaches them, so when an account's brand settings change,
 * every already-published card keeps serving the old artwork — indefinitely on
 * X, Slack, Discord and WhatsApp, which offer no refresh tool at all.
 *
 * The only lever that works is changing the URL. `?v=` exists purely to be
 * that lever: it never affects rendering, it just changes the cache key.
 */
export const CACHE_VERSION_PARAM = "v";

/** Bounded so a caller can't flood caches with unbounded distinct keys. */
const VERSION_TOKEN = /^[A-Za-z0-9._-]{1,32}$/;

export function isValidCacheVersion(value: string): boolean {
  return VERSION_TOKEN.test(value);
}

/**
 * Raises the account's cache version, which is what makes newly built URLs
 * differ from the ones already cached. Returns the new value.
 */
export async function bumpCacheVersion(
  db: Database,
  userId: string,
  opts: { brandChanged?: boolean } = {}
): Promise<number> {
  const now = new Date();
  await db
    .update(users)
    .set({
      cacheVersion: sql`${users.cacheVersion} + 1`,
      ...(opts.brandChanged ? { brandUpdatedAt: now } : {}),
    })
    .where(eq(users.id, userId));

  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { cacheVersion: true },
  });
  return row?.cacheVersion ?? 1;
}

/**
 * Clears the "you still need to republish" flag once the account has put the
 * current version into its own pages. Does not change the version itself.
 */
export async function acknowledgeRepublish(
  db: Database,
  userId: string
): Promise<void> {
  await db
    .update(users)
    .set({ brandUpdatedAt: null })
    .where(eq(users.id, userId));
}

export interface RefreshStatus {
  version: number;
  brandUpdatedAt: Date | null;
  /** True when brand settings changed and cards may still show the old look. */
  needsRepublish: boolean;
}

/**
 * Whether the account has pending changes that published cards won't be
 * showing yet. Only meaningful once brand settings have been touched at all.
 */
export function refreshStatus(user: {
  cacheVersion: number;
  brandUpdatedAt: Date | null;
}): RefreshStatus {
  return {
    version: user.cacheVersion,
    brandUpdatedAt: user.brandUpdatedAt,
    needsRepublish: user.brandUpdatedAt !== null,
  };
}

/** Adds the version to a set of params, so callers build URLs consistently. */
export function withCacheVersion(
  params: URLSearchParams,
  version: number | string
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set(CACHE_VERSION_PARAM, String(version));
  return next;
}
