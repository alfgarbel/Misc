import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { createTestDb } from "./helpers";
import { users, subscriptions, usage, apiKeys } from "@/lib/db/schema";
import { isAdminEmail, isAdminUser, getAdminMetrics } from "@/lib/admin";

describe("isAdminEmail", () => {
  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("matches configured emails case-insensitively, with whitespace", () => {
    process.env.ADMIN_EMAILS = " Admin@Example.com , boss@x.dev ";
    expect(isAdminEmail("admin@example.com")).toBe(true);
    expect(isAdminEmail("ADMIN@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("boss@x.dev")).toBe(true);
    expect(isAdminEmail("intruder@x.dev")).toBe(false);
  });

  it("requires a verified email for admin access", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    const base = { email: "admin@example.com" };
    expect(isAdminUser({ ...base, emailVerifiedAt: new Date() })).toBe(true);
    expect(isAdminUser({ ...base, emailVerifiedAt: null })).toBe(false);
    expect(
      isAdminUser({ email: "other@example.com", emailVerifiedAt: new Date() })
    ).toBe(false);
  });

  it("denies everyone when unset or empty", () => {
    expect(isAdminEmail("anyone@x.dev")).toBe(false);
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("anyone@x.dev")).toBe(false);
    // An empty entry must not match an empty string.
    process.env.ADMIN_EMAILS = ",,";
    expect(isAdminEmail("")).toBe(false);
  });
});

describe("getAdminMetrics", () => {
  const NOW = new Date("2026-08-23T12:00:00Z");

  async function seed(db: Awaited<ReturnType<typeof createTestDb>>) {
    const mk = async (
      email: string,
      plan: string,
      status: string,
      createdAt: Date,
      verified: boolean
    ) => {
      const id = randomUUID();
      await db.insert(users).values({
        id,
        email,
        passwordHash: "x",
        createdAt,
        emailVerifiedAt: verified ? createdAt : null,
      });
      await db.insert(subscriptions).values({ userId: id, plan, status });
      return id;
    };
    const a = await mk("a@t.dev", "pro", "active", new Date("2026-08-22T10:00:00Z"), true);
    const b = await mk("b@t.dev", "scale", "active", new Date("2026-08-22T11:00:00Z"), true);
    const c = await mk("c@t.dev", "free", "active", new Date("2026-08-01T10:00:00Z"), false);
    // A canceled pro subscription must not count as paying.
    await mk("d@t.dev", "pro", "canceled", new Date("2026-06-01T10:00:00Z"), true);

    await db.insert(usage).values([
      { userId: a, month: "2026-08", count: 500 },
      { userId: b, month: "2026-08", count: 1200 },
      { userId: c, month: "2026-08", count: 30 },
      { userId: a, month: "2026-07", count: 900 },
    ]);
    await db.insert(apiKeys).values([
      { id: randomUUID(), userId: a, keyHash: randomUUID(), keyPrefix: "og_1" },
      { id: randomUUID(), userId: b, keyHash: randomUUID(), keyPrefix: "og_2" },
      {
        id: randomUUID(),
        userId: b,
        keyHash: randomUUID(),
        keyPrefix: "og_3",
        revokedAt: NOW,
      },
    ]);
  }

  it("aggregates users, plans, MRR, keys, and renders", async () => {
    const db = await createTestDb();
    await seed(db);
    const m = await getAdminMetrics(db, NOW);

    expect(m.totalUsers).toBe(4);
    expect(m.verifiedUsers).toBe(3);
    expect(m.planCounts).toEqual({ free: 2, pro: 1, scale: 1 });
    expect(m.payingCustomers).toBe(2);
    expect(m.mrrUsd).toBe(9 + 29);
    expect(m.activeKeys).toBe(2);
    expect(m.rendersThisMonth).toBe(1730);
  });

  it("builds zero-filled series and ranked top accounts", async () => {
    const db = await createTestDb();
    await seed(db);
    const m = await getAdminMetrics(db, NOW);

    expect(m.signupsLast30Days).toHaveLength(30);
    expect(m.signupsLast30Days.at(-1)?.day).toBe("2026-08-23");
    const aug22 = m.signupsLast30Days.find((d) => d.day === "2026-08-22");
    expect(aug22?.count).toBe(2);
    // d@t.dev signed up in June — outside the window.
    expect(m.signupsLast30Days.reduce((s, d) => s + d.count, 0)).toBe(3);

    expect(m.rendersByMonth).toHaveLength(6);
    expect(m.rendersByMonth.at(-1)).toEqual({ month: "2026-08", count: 1730 });
    expect(m.rendersByMonth.at(-2)).toEqual({ month: "2026-07", count: 900 });
    expect(m.rendersByMonth[0].count).toBe(0);

    expect(m.topAccounts[0]).toEqual({ email: "b@t.dev", renders: 1200, plan: "scale" });
    expect(m.topAccounts[1]).toEqual({ email: "a@t.dev", renders: 500, plan: "pro" });
    expect(m.topAccounts).toHaveLength(3);
  });

  it("handles an empty database", async () => {
    const db = await createTestDb();
    const m = await getAdminMetrics(db, NOW);
    expect(m.totalUsers).toBe(0);
    expect(m.mrrUsd).toBe(0);
    expect(m.topAccounts).toEqual([]);
    expect(m.signupsLast30Days.every((d) => d.count === 0)).toBe(true);
  });
});
