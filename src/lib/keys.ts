import { createHash, randomBytes, randomUUID } from "crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "./db";
import { apiKeys, keyUsage } from "./db/schema";
import { currentMonth } from "./plans";

export const KEY_PREFIX = "og_";
export const MAX_ACTIVE_KEYS = 10;
export const MAX_KEY_NAME_LENGTH = 60;

/** Generates a new plaintext API key, e.g. "og_1a2b...". 43 chars total. */
export function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(20).toString("hex");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** The displayable, non-secret prefix of a key, e.g. "og_1a2b3c4d". */
export function keyDisplayPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX.length + 8);
}

export function looksLikeApiKey(key: string): boolean {
  return /^og_[0-9a-f]{40}$/.test(key);
}

export interface CreatedKey {
  id: string;
  /** Plaintext key — the only time it is ever available. */
  key: string;
}

/**
 * Creates a named API key for a user, up to MAX_ACTIVE_KEYS active keys.
 * Returns null when the limit is reached.
 */
export async function createApiKey(
  db: Database,
  userId: string,
  name: string
): Promise<CreatedKey | null> {
  const active = await db.query.apiKeys.findMany({
    where: and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)),
    columns: { id: true },
  });
  if (active.length >= MAX_ACTIVE_KEYS) return null;
  const key = generateApiKey();
  const id = randomUUID();
  await db.insert(apiKeys).values({
    id,
    userId,
    name: name.trim().slice(0, MAX_KEY_NAME_LENGTH) || "Default",
    keyHash: hashApiKey(key),
    keyPrefix: keyDisplayPrefix(key),
  });
  return { id, key };
}

/** Revokes one of the user's keys. Returns false if it wasn't theirs/active. */
export async function revokeApiKey(
  db: Database,
  userId: string,
  keyId: string
): Promise<boolean> {
  const row = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.id, keyId),
      eq(apiKeys.userId, userId),
      isNull(apiKeys.revokedAt)
    ),
  });
  if (!row) return false;
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId));
  return true;
}

export interface ResolvedKey {
  userId: string;
  keyId: string;
}

/** Resolves a plaintext key to its owner, or null if invalid/revoked. */
export async function resolveApiKey(
  db: Database,
  key: string
): Promise<ResolvedKey | null> {
  if (!looksLikeApiKey(key)) return null;
  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, hashApiKey(key)), isNull(apiKeys.revokedAt)),
  });
  return row ? { userId: row.userId, keyId: row.id } : null;
}

export interface KeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  rendersThisMonth: number;
}

/** Lists the user's active keys with this month's per-key render counts. */
export async function listActiveKeys(
  db: Database,
  userId: string,
  month: string = currentMonth()
): Promise<KeySummary[]> {
  const keys = await db.query.apiKeys.findMany({
    where: and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)),
    orderBy: (k, { asc }) => [asc(k.createdAt)],
  });
  if (keys.length === 0) return [];
  const counts = await db.query.keyUsage.findMany({
    where: and(
      inArray(
        keyUsage.keyId,
        keys.map((k) => k.id)
      ),
      eq(keyUsage.month, month)
    ),
  });
  const byKey = new Map(counts.map((c) => [c.keyId, c.count]));
  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    rendersThisMonth: byKey.get(k.id) ?? 0,
  }));
}
