import { createHash, randomBytes, randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "./db";
import { apiKeys } from "./db/schema";

export const KEY_PREFIX = "og_";

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

/**
 * Creates a fresh API key for a user, revoking any active ones.
 * Returns the plaintext key — the only time it is ever available.
 */
export async function rotateApiKey(
  db: Database,
  userId: string
): Promise<string> {
  const key = generateApiKey();
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
  await db.insert(apiKeys).values({
    id: randomUUID(),
    userId,
    keyHash: hashApiKey(key),
    keyPrefix: keyDisplayPrefix(key),
  });
  return key;
}

/** Resolves a plaintext key to its owning user id, or null if invalid/revoked. */
export async function resolveApiKey(
  db: Database,
  key: string
): Promise<string | null> {
  if (!looksLikeApiKey(key)) return null;
  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, hashApiKey(key)), isNull(apiKeys.revokedAt)),
  });
  return row?.userId ?? null;
}
