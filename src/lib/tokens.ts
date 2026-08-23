import { createHash, randomBytes, randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "./db";
import { authTokens } from "./db/schema";

export type TokenType = "verify" | "reset";

const TTL_HOURS: Record<TokenType, number> = {
  verify: 24 * 7,
  reset: 1,
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issues a single-use token and returns its plaintext (only shown once). */
export async function createAuthToken(
  db: Database,
  userId: string,
  type: TokenType,
  now: Date = new Date()
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(authTokens).values({
    id: randomUUID(),
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + TTL_HOURS[type] * 3600_000),
  });
  return token;
}

/**
 * Validates a token and consumes it (single use).
 * Returns the owning userId, or null if unknown/expired/used/wrong type.
 */
export async function consumeAuthToken(
  db: Database,
  token: string,
  type: TokenType,
  now: Date = new Date()
): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await db.query.authTokens.findFirst({
    where: and(
      eq(authTokens.tokenHash, hashToken(token)),
      eq(authTokens.type, type),
      isNull(authTokens.usedAt)
    ),
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < now.getTime()) return null;
  await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(eq(authTokens.id, row.id));
  return row.userId;
}
