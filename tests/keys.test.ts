import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import {
  generateApiKey,
  hashApiKey,
  keyDisplayPrefix,
  looksLikeApiKey,
  createApiKey,
  revokeApiKey,
  resolveApiKey,
  listActiveKeys,
  MAX_ACTIVE_KEYS,
} from "@/lib/keys";
import { recordKeyRender } from "@/lib/usage";
import { users, apiKeys } from "@/lib/db/schema";
import { createTestDb } from "./helpers";

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

  it("creates named keys, hashing them and never storing plaintext", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const created = await createApiKey(db, userId, "  blog-production  ");
    expect(created).not.toBeNull();
    const rows = await db.select().from(apiKeys);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("blog-production");
    expect(rows[0].keyHash).toBe(hashApiKey(created!.key));
    expect(rows[0].keyHash).not.toContain(created!.key.slice(11));
  });

  it("resolves a valid key to user + key ids and rejects a revoked one", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const k1 = (await createApiKey(db, userId, "one"))!;
    const k2 = (await createApiKey(db, userId, "two"))!;

    expect(await resolveApiKey(db, k1.key)).toEqual({ userId, keyId: k1.id });
    expect(await resolveApiKey(db, k2.key)).toEqual({ userId, keyId: k2.id });

    // Revoking one key leaves the other working.
    expect(await revokeApiKey(db, userId, k1.id)).toBe(true);
    expect(await resolveApiKey(db, k1.key)).toBeNull();
    expect(await resolveApiKey(db, k2.key)).toEqual({ userId, keyId: k2.id });

    // Re-revoking or revoking someone else's key fails.
    expect(await revokeApiKey(db, userId, k1.id)).toBe(false);
    const other = await seedUser(db);
    expect(await revokeApiKey(db, other, k2.id)).toBe(false);
  });

  it("enforces the active-key limit", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    for (let i = 0; i < MAX_ACTIVE_KEYS; i++) {
      expect(await createApiKey(db, userId, `key-${i}`)).not.toBeNull();
    }
    expect(await createApiKey(db, userId, "one-too-many")).toBeNull();
    // Revoking frees a slot.
    const keys = await listActiveKeys(db, userId);
    await revokeApiKey(db, userId, keys[0].id);
    expect(await createApiKey(db, userId, "fits-now")).not.toBeNull();
  });

  it("attributes renders per key and tracks last use", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const k1 = (await createApiKey(db, userId, "one"))!;
    const k2 = (await createApiKey(db, userId, "two"))!;

    await recordKeyRender(db, k1.id, "2026-08");
    await recordKeyRender(db, k1.id, "2026-08");
    await recordKeyRender(db, k2.id, "2026-08");
    await recordKeyRender(db, k1.id, "2026-09");

    const aug = await listActiveKeys(db, userId, "2026-08");
    const byName = Object.fromEntries(aug.map((k) => [k.name, k]));
    expect(byName.one.rendersThisMonth).toBe(2);
    expect(byName.two.rendersThisMonth).toBe(1);
    expect(byName.one.lastUsedAt).not.toBeNull();

    const sep = await listActiveKeys(db, userId, "2026-09");
    expect(sep.find((k) => k.name === "one")?.rendersThisMonth).toBe(1);
    expect(sep.find((k) => k.name === "two")?.rendersThisMonth).toBe(0);
  });

  it("rejects unknown keys", async () => {
    const db = await createTestDb();
    expect(await resolveApiKey(db, generateApiKey())).toBeNull();
  });
});
