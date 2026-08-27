import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers";
import { users } from "@/lib/db/schema";
import { provisionAccount } from "@/lib/accounts";
import {
  TRIAL_DAYS,
  effectiveWatermark,
  trialActive,
  trialDaysLeft,
  trialEndFor,
} from "@/lib/trial";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-08-27T12:00:00Z");
const ends = (offsetDays: number) => ({
  trialEndsAt: new Date(now.getTime() + offsetDays * DAY),
});

describe("trialActive", () => {
  it("is active while the end date is ahead", () => {
    expect(trialActive(ends(1), now)).toBe(true);
    expect(trialActive(ends(TRIAL_DAYS), now)).toBe(true);
  });

  it("is over once the end date passes", () => {
    expect(trialActive(ends(-1), now)).toBe(false);
    // Exactly at the boundary counts as over, so it can never linger.
    expect(trialActive({ trialEndsAt: now }, now)).toBe(false);
  });

  it("treats an account with no trial as not in one", () => {
    // Accounts that existed before trials do not retroactively get one.
    expect(trialActive({ trialEndsAt: null }, now)).toBe(false);
  });
});

describe("trialDaysLeft", () => {
  it("rounds up, so a part-day still reads as a day", () => {
    expect(trialDaysLeft({ trialEndsAt: new Date(now.getTime() + DAY / 2) }, now)).toBe(1);
    expect(trialDaysLeft(ends(13.2), now)).toBe(14);
  });

  it("is zero once ended or absent", () => {
    expect(trialDaysLeft(ends(-1), now)).toBe(0);
    expect(trialDaysLeft({ trialEndsAt: null }, now)).toBe(0);
  });
});

describe("effectiveWatermark", () => {
  it("clears the watermark for a free account inside its trial", () => {
    expect(effectiveWatermark("free", ends(3), now)).toBe(false);
  });

  it("restores it when the trial ends", () => {
    expect(effectiveWatermark("free", ends(-1), now)).toBe(true);
    expect(effectiveWatermark("free", { trialEndsAt: null }, now)).toBe(true);
  });

  it("never adds a watermark to a paid plan, trial or not", () => {
    for (const bearer of [ends(3), ends(-1), { trialEndsAt: null }]) {
      expect(effectiveWatermark("pro", bearer, now)).toBe(false);
      expect(effectiveWatermark("scale", bearer, now)).toBe(false);
    }
  });

  it("depends only on the account, so a site never renders both ways", () => {
    // A per-render rule would watermark some posts and not others
    // depending on the order crawlers happened to arrive in.
    const bearer = ends(3);
    const results = Array.from({ length: 50 }, () =>
      effectiveWatermark("free", bearer, now)
    );
    expect(new Set(results).size).toBe(1);
  });
});

describe("new accounts", () => {
  it("start a trial at sign-up", async () => {
    const db = await createTestDb();
    const before = Date.now();
    const { userId } = await provisionAccount(db, {
      email: "new@example.com",
      passwordHash: "h",
    });
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(user?.trialEndsAt).toBeInstanceOf(Date);
    const days = (user!.trialEndsAt!.getTime() - before) / DAY;
    expect(days).toBeGreaterThan(TRIAL_DAYS - 0.1);
    expect(days).toBeLessThanOrEqual(TRIAL_DAYS + 0.1);
  });

  it("renders without a watermark on the free plan right after sign-up", async () => {
    const db = await createTestDb();
    const { userId } = await provisionAccount(db, {
      email: "new@example.com",
      passwordHash: "h",
    });
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(effectiveWatermark("free", user!)).toBe(false);
  });
});

describe("trialEndFor", () => {
  it("is exactly the trial length ahead", () => {
    expect(trialEndFor(now).getTime()).toBe(now.getTime() + TRIAL_DAYS * DAY);
  });
});
