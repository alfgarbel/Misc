import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers";
import { users } from "@/lib/db/schema";
import { provisionAccount } from "@/lib/accounts";
import {
  CACHE_VERSION_PARAM,
  acknowledgeRepublish,
  bumpCacheVersion,
  isValidCacheVersion,
  refreshStatus,
  withCacheVersion,
} from "@/lib/cachebust";
import { signParams, verifySignature } from "@/lib/signing";
import { parseOgParams, applyBrandDefaults } from "@/lib/og/params";

async function seedUser() {
  const db = await createTestDb();
  const { userId } = await provisionAccount(db, {
    email: "ada@example.com",
    passwordHash: "hashed",
  });
  return { db, userId };
}

describe("isValidCacheVersion", () => {
  it("accepts version numbers, build ids and content hashes", () => {
    for (const v of ["1", "42", "2026.08.26", "a1b2c3d4", "build_991-rc1"]) {
      expect(isValidCacheVersion(v)).toBe(true);
    }
  });

  it("rejects anything that could be used to mint unbounded cache keys", () => {
    expect(isValidCacheVersion("")).toBe(false);
    expect(isValidCacheVersion("x".repeat(33))).toBe(false);
    expect(isValidCacheVersion("has space")).toBe(false);
    expect(isValidCacheVersion("slash/es")).toBe(false);
    expect(isValidCacheVersion("emoji✨")).toBe(false);
  });

  it("allows exactly 32 characters", () => {
    expect(isValidCacheVersion("x".repeat(32))).toBe(true);
  });
});

describe("bumpCacheVersion", () => {
  it("starts new accounts at version 1", async () => {
    const { db, userId } = await seedUser();
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(user?.cacheVersion).toBe(1);
    expect(user?.brandUpdatedAt).toBeNull();
  });

  it("increments and returns the new version", async () => {
    const { db, userId } = await seedUser();
    expect(await bumpCacheVersion(db, userId)).toBe(2);
    expect(await bumpCacheVersion(db, userId)).toBe(3);
  });

  it("records the change time only when the brand actually changed", async () => {
    const { db, userId } = await seedUser();

    await bumpCacheVersion(db, userId);
    let user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(user?.brandUpdatedAt).toBeNull();

    await bumpCacheVersion(db, userId, { brandChanged: true });
    user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(user?.brandUpdatedAt).toBeInstanceOf(Date);
  });

  it("leaves other accounts untouched", async () => {
    const { db, userId } = await seedUser();
    const { userId: otherId } = await provisionAccount(db, {
      email: "grace@example.com",
      passwordHash: "hashed",
    });

    await bumpCacheVersion(db, userId, { brandChanged: true });

    const other = await db.query.users.findFirst({
      where: eq(users.id, otherId),
    });
    expect(other?.cacheVersion).toBe(1);
    expect(other?.brandUpdatedAt).toBeNull();
  });
});

describe("acknowledgeRepublish", () => {
  it("clears the reminder without rolling back the version", async () => {
    const { db, userId } = await seedUser();
    await bumpCacheVersion(db, userId, { brandChanged: true });

    await acknowledgeRepublish(db, userId);

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(user?.brandUpdatedAt).toBeNull();
    expect(user?.cacheVersion).toBe(2);
  });
});

describe("refreshStatus", () => {
  it("says nothing needs republishing on an untouched account", () => {
    expect(refreshStatus({ cacheVersion: 1, brandUpdatedAt: null })).toEqual({
      version: 1,
      brandUpdatedAt: null,
      needsRepublish: false,
    });
  });

  it("flags an account whose brand changed after its cards were published", () => {
    const changedAt = new Date("2026-08-26T10:00:00Z");
    expect(
      refreshStatus({ cacheVersion: 4, brandUpdatedAt: changedAt })
    ).toEqual({ version: 4, brandUpdatedAt: changedAt, needsRepublish: true });
  });
});

describe("withCacheVersion", () => {
  it("adds the version without disturbing the other params", () => {
    const params = new URLSearchParams({ title: "Hello", template: "split" });
    const next = withCacheVersion(params, 7);
    expect(next.get(CACHE_VERSION_PARAM)).toBe("7");
    expect(next.get("title")).toBe("Hello");
    expect(next.get("template")).toBe("split");
  });

  it("replaces a stale version rather than appending a second one", () => {
    const params = new URLSearchParams({ title: "Hello", v: "3" });
    const next = withCacheVersion(params, 8);
    expect(next.getAll(CACHE_VERSION_PARAM)).toEqual(["8"]);
  });

  it("does not mutate the params it was given", () => {
    const params = new URLSearchParams({ title: "Hello" });
    withCacheVersion(params, 2);
    expect(params.has(CACHE_VERSION_PARAM)).toBe(false);
  });
});

describe("the version never changes the image", () => {
  it("is dropped before the render parameters are parsed", () => {
    const base = new URLSearchParams({ title: "Hello", template: "split" });
    const versioned = withCacheVersion(base, 9);

    const a = parseOgParams(base);
    const b = parseOgParams(versioned);
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) expect(b.data).toEqual(a.data);
  });

  it("survives brand defaults being applied on top", () => {
    const versioned = withCacheVersion(
      new URLSearchParams({ title: "Hello" }),
      5
    );
    const merged = applyBrandDefaults(versioned, {
      template: "terminal",
      theme: "light",
      accent: "#f43f5e",
      site: "example.com",
    });
    expect(merged.get(CACHE_VERSION_PARAM)).toBe("5");

    const parsed = parseOgParams(merged);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.template).toBe("terminal");
  });
});

describe("signed URLs and the version", () => {
  const secret = "s".repeat(64);

  it("covers v in the signature, so a bumped URL must be re-signed", () => {
    const params = withCacheVersion(
      new URLSearchParams({ acct: "user_1", title: "Hello" }),
      1
    );
    params.set("sig", signParams(params, secret));
    expect(verifySignature(params, secret)).toBe(true);

    // Bumping the version without re-signing must not verify — otherwise a
    // leaked link could be replayed with arbitrary cache keys.
    const bumped = withCacheVersion(params, 2);
    expect(verifySignature(bumped, secret)).toBe(false);

    const resigned = new URLSearchParams(bumped);
    resigned.delete("sig");
    resigned.set("sig", signParams(resigned, secret));
    expect(verifySignature(resigned, secret)).toBe(true);
  });
});
