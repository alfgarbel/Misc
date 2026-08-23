import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import {
  generateApiKey,
  hashApiKey,
  keyDisplayPrefix,
  looksLikeApiKey,
  rotateApiKey,
  resolveApiKey,
} from "@/lib/keys";
import { users, apiKeys } from "@/lib/db/schema";
import { createTestDb } from "./helpers";
import { and, eq, isNull } from "drizzle-orm";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>) {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `${id}@test.dev`, passwordHash: "x" });
  return id;
}

describe("API keys", () => {
  it("generates well-formed unique keys", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).toMatch(/^og_[0-9a-f]{40}$/);
    expect(looksLikeApiKey(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(keyDisplayPrefix(a)).toBe(a.slice(0, 11));
  });

  it("rejects malformed keys without touching the db", () => {
    expect(looksLikeApiKey("og_short")).toBe(false);
    expect(looksLikeApiKey("sk_" + "a".repeat(40))).toBe(false);
  });

  it("hashes deterministically and never stores plaintext", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const key = await rotateApiKey(db, userId);
    const rows = await db.select().from(apiKeys);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyHash).toBe(hashApiKey(key));
    expect(rows[0].keyHash).not.toContain(key.slice(11));
  });

  it("resolves a valid key to its user and rejects a revoked one", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const key1 = await rotateApiKey(db, userId);
    expect(await resolveApiKey(db, key1)).toBe(userId);

    const key2 = await rotateApiKey(db, userId);
    expect(await resolveApiKey(db, key1)).toBeNull();
    expect(await resolveApiKey(db, key2)).toBe(userId);

    const active = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
    expect(active).toHaveLength(1);
  });

  it("rejects unknown keys", async () => {
    const db = await createTestDb();
    expect(await resolveApiKey(db, generateApiKey())).toBeNull();
  });
});
