import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { createAuthToken, consumeAuthToken } from "@/lib/tokens";
import { createTestDb } from "./helpers";
import { users, authTokens } from "@/lib/db/schema";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>) {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `${id}@t.dev`, passwordHash: "x" });
  return id;
}

describe("auth tokens", () => {
  it("issues and consumes a token exactly once", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const token = await createAuthToken(db, userId, "verify");
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    expect(await consumeAuthToken(db, token, "verify")).toBe(userId);
    // Second use fails — single-use.
    expect(await consumeAuthToken(db, token, "verify")).toBeNull();
  });

  it("stores only a hash, never the plaintext", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const token = await createAuthToken(db, userId, "reset");
    const rows = await db.select().from(authTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
  });

  it("rejects a token of the wrong type", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const token = await createAuthToken(db, userId, "reset");
    expect(await consumeAuthToken(db, token, "verify")).toBeNull();
    // Wrong-type attempt must not consume it.
    expect(await consumeAuthToken(db, token, "reset")).toBe(userId);
  });

  it("enforces expiry per type", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const issued = new Date("2026-08-23T12:00:00Z");

    const reset = await createAuthToken(db, userId, "reset", issued);
    // Reset tokens last 1 hour.
    expect(
      await consumeAuthToken(db, reset, "reset", new Date("2026-08-23T13:30:00Z"))
    ).toBeNull();

    const verify = await createAuthToken(db, userId, "verify", issued);
    // Verify tokens last 7 days.
    expect(
      await consumeAuthToken(db, verify, "verify", new Date("2026-08-29T12:00:00Z"))
    ).toBe(userId);
  });

  it("rejects malformed and unknown tokens", async () => {
    const db = await createTestDb();
    expect(await consumeAuthToken(db, "zz".repeat(32), "verify")).toBeNull();
    expect(await consumeAuthToken(db, "ab".repeat(32), "verify")).toBeNull();
  });
});
