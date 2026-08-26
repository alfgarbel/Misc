import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers";
import { users, subscriptions, apiKeys } from "@/lib/db/schema";
import { provisionAccount, signInWithGoogle } from "@/lib/accounts";
import type { GoogleProfile } from "@/lib/oauth";

const profile = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
  googleId: "google-sub-1",
  email: "ada@example.com",
  emailVerified: true,
  name: "Ada Lovelace",
  ...over,
});

describe("provisionAccount", () => {
  it("creates a full account: subscription, signing secret and first key", async () => {
    const db = await createTestDb();
    const { userId, apiKey } = await provisionAccount(db, {
      email: "new@example.com",
      passwordHash: "hashed",
    });

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(user?.email).toBe("new@example.com");
    expect(user?.passwordHash).toBe("hashed");
    expect(user?.signingSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(user?.emailVerifiedAt).toBeNull();

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });
    expect(sub?.plan).toBe("free");
    expect(apiKey).toMatch(/^og_[0-9a-f]{40}$/);
    expect(await db.select().from(apiKeys)).toHaveLength(1);
  });

  it("creates a passwordless account and marks verified emails", async () => {
    const db = await createTestDb();
    const { userId } = await provisionAccount(db, {
      email: "g@example.com",
      googleId: "sub-1",
      name: "Grace",
      emailVerified: true,
    });
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(user?.passwordHash).toBeNull();
    expect(user?.googleId).toBe("sub-1");
    expect(user?.name).toBe("Grace");
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
  });
});

describe("signInWithGoogle", () => {
  it("creates an account on first sign-in", async () => {
    const db = await createTestDb();
    const r = await signInWithGoogle(db, profile());
    expect(r.outcome).toBe("created");
    expect(r.apiKey).toMatch(/^og_/);

    const user = await db.query.users.findFirst({ where: eq(users.id, r.userId) });
    expect(user?.googleId).toBe("google-sub-1");
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("returns the same account on repeat sign-ins, without a new key", async () => {
    const db = await createTestDb();
    const first = await signInWithGoogle(db, profile());
    const second = await signInWithGoogle(db, profile());
    expect(second.userId).toBe(first.userId);
    expect(second.outcome).toBe("existing");
    expect(second.apiKey).toBeNull();
    expect(await db.select().from(users)).toHaveLength(1);
    // A second sign-in must not mint another API key.
    expect(await db.select().from(apiKeys)).toHaveLength(1);
  });

  it("matches on google id even after the Google account changes email", async () => {
    const db = await createTestDb();
    const first = await signInWithGoogle(db, profile());
    const renamed = await signInWithGoogle(
      db,
      profile({ email: "ada.new@example.com" })
    );
    expect(renamed.userId).toBe(first.userId);
    expect(renamed.outcome).toBe("existing");
  });

  it("links to an existing password account with the same verified email", async () => {
    const db = await createTestDb();
    const existing = await provisionAccount(db, {
      email: "ada@example.com",
      passwordHash: "bcrypt-hash",
    });

    const r = await signInWithGoogle(db, profile());
    expect(r.outcome).toBe("linked");
    expect(r.userId).toBe(existing.userId);
    expect(await db.select().from(users)).toHaveLength(1);

    const user = await db.query.users.findFirst({ where: eq(users.id, r.userId) });
    // Linking must not destroy the existing password login.
    expect(user?.passwordHash).toBe("bcrypt-hash");
    expect(user?.googleId).toBe("google-sub-1");
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("refuses to link an unverified Google email to an existing account", async () => {
    const db = await createTestDb();
    await provisionAccount(db, {
      email: "ada@example.com",
      passwordHash: "bcrypt-hash",
    });

    await expect(
      signInWithGoogle(db, profile({ emailVerified: false }))
    ).rejects.toThrow("UNVERIFIED_GOOGLE_EMAIL");

    // The victim account must be untouched — no google id attached.
    const user = await db.query.users.findFirst({
      where: eq(users.email, "ada@example.com"),
    });
    expect(user?.googleId).toBeNull();
  });

  it("still creates a fresh account when an unverified email is unknown", async () => {
    const db = await createTestDb();
    const r = await signInWithGoogle(db, profile({ emailVerified: false }));
    expect(r.outcome).toBe("created");
    const user = await db.query.users.findFirst({ where: eq(users.id, r.userId) });
    // Unverified means we don't grant a verified badge.
    expect(user?.emailVerifiedAt).toBeNull();
  });

  it("keeps separate accounts for different Google identities", async () => {
    const db = await createTestDb();
    const a = await signInWithGoogle(db, profile());
    const b = await signInWithGoogle(
      db,
      profile({ googleId: "google-sub-2", email: "grace@example.com" })
    );
    expect(a.userId).not.toBe(b.userId);
    expect(await db.select().from(users)).toHaveLength(2);
  });
});
