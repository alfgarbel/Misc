import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers";
import { users, subscriptions, events } from "@/lib/db/schema";
import { getFunnel, isSocialCrawler, markLive, recordEvent, trackRender } from "@/lib/funnel";
import { classifyOgImage, saveOnboardingUrl } from "@/lib/onboarding";
import { createApiKey, revokeApiKey } from "@/lib/keys";
import { runActivationEmails } from "@/lib/activation";
import { provisionAccount } from "@/lib/accounts";

vi.mock("@/lib/mailer", () => ({
  sendEmail: vi.fn(async () => true),
}));
import { sendEmail } from "@/lib/mailer";

type Db = Awaited<ReturnType<typeof createTestDb>>;
const DAY = 24 * 60 * 60 * 1000;

async function seedUser(db: Db, fields: Partial<typeof users.$inferInsert> = {}) {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `${id}@t.dev`, passwordHash: "x", ...fields });
  await db.insert(subscriptions).values({ userId: id, plan: "free" });
  return id;
}

async function loadUser(db: Db, id: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!u) throw new Error("missing user");
  return u;
}

async function eventNames(db: Db, userId: string) {
  const rows = await db.select().from(events).where(eq(events.userId, userId));
  return rows.map((r) => r.name).sort();
}

describe("social crawler detection", () => {
  it("recognises the bots platforms send when a link is shared", () => {
    for (const ua of [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Twitterbot/1.0",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "WhatsApp/2.23.20.0",
      "TelegramBot (like TwitterBot)",
    ]) {
      expect(isSocialCrawler(ua), ua).toBe(true);
    }
  });

  it("does not count a browser or a missing user agent", () => {
    expect(
      isSocialCrawler(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15"
      )
    ).toBe(false);
    expect(isSocialCrawler(null)).toBe(false);
  });
});

describe("activation milestones", () => {
  it("records the first render once, however many renders follow", async () => {
    const db = await createTestDb();
    const id = await seedUser(db);
    await trackRender(db, await loadUser(db, id), "Mozilla/5.0");
    // A stale account row (concurrent request) must not record it again.
    await trackRender(db, { id, firstRenderAt: null, liveAt: null }, "Mozilla/5.0");
    const user = await loadUser(db, id);
    expect(user.firstRenderAt).not.toBeNull();
    expect(user.liveAt).toBeNull();
    expect(await eventNames(db, id)).toEqual(["first_render"]);
  });

  it("marks an account live when a social crawler fetches its card", async () => {
    const db = await createTestDb();
    const id = await seedUser(db);
    await trackRender(db, await loadUser(db, id), "Twitterbot/1.0");
    expect((await loadUser(db, id)).liveAt).not.toBeNull();
    expect(await eventNames(db, id)).toEqual(["first_render", "live"]);
  });

  it("markLive also completes the render step it implies", async () => {
    const db = await createTestDb();
    const id = await seedUser(db);
    await markLive(db, id);
    await markLive(db, id);
    expect(await eventNames(db, id)).toEqual(["first_render", "live"]);
  });

  it("records a signup when an account is provisioned", async () => {
    const db = await createTestDb();
    const { userId } = await provisionAccount(db, { email: "new@t.dev", passwordHash: "x" });
    expect(await eventNames(db, userId)).toEqual(["signup"]);
  });
});

describe("funnel report", () => {
  it("counts checks per run and later steps per account, inside the window", async () => {
    const db = await createTestDb();
    const now = new Date("2026-10-11T12:00:00Z");
    const a = await seedUser(db);
    const b = await seedUser(db);
    for (let i = 0; i < 10; i++) await recordEvent(db, "check_run", null, now);
    await recordEvent(db, "signup", a, now);
    await recordEvent(db, "signup", b, now);
    // A webhook retried twice is still one paying account.
    await recordEvent(db, "checkout", a, now);
    await recordEvent(db, "checkout", a, now);
    // Outside the window.
    await recordEvent(db, "check_run", null, new Date(now.getTime() - 40 * DAY));

    const funnel = await getFunnel(db, 30, now);
    const byStep = Object.fromEntries(funnel.map((f) => [f.step, f]));
    expect(byStep.check_run.count).toBe(10);
    expect(byStep.signup.count).toBe(2);
    expect(byStep.signup.fromPrevious).toBe(20);
    expect(byStep.first_render.count).toBe(0);
    expect(byStep.live.fromPrevious).toBeNull();
    expect(byStep.checkout.count).toBe(1);
  });
});

describe("finding a customer's card on their page", () => {
  const page = "https://blog.example.com/post";

  it("recognises a card rendered with one of the account's keys", async () => {
    const db = await createTestDb();
    const id = await seedUser(db);
    const created = await createApiKey(db, id, "Site");
    const tag = `https://ogsmith.app/api/og?key=${created!.key}&amp;url=${encodeURIComponent(page)}`;
    expect(await classifyOgImage(db, id, tag, page)).toBe("live");
  });

  it("recognises a signed URL naming the account", async () => {
    const db = await createTestDb();
    const id = await seedUser(db);
    expect(
      await classifyOgImage(db, id, `https://ogsmith.app/api/og?acct=${id}&sig=abc&title=Hi`, page)
    ).toBe("live");
  });

  it("tells apart a missing image, someone else's image and someone else's key", async () => {
    const db = await createTestDb();
    const id = await seedUser(db);
    const other = await seedUser(db);
    const theirs = await createApiKey(db, other, "Theirs");
    expect(await classifyOgImage(db, id, null, page)).toBe("no_image");
    expect(await classifyOgImage(db, id, "/images/cover.png", page)).toBe("not_ogsmith");
    expect(
      await classifyOgImage(db, id, `https://ogsmith.app/api/og?key=${theirs!.key}`, page)
    ).toBe("other_account");
    expect(await classifyOgImage(db, id, "https://ogsmith.app/api/og?title=Demo", page)).toBe(
      "other_account"
    );
  });

  it("does not accept a revoked key", async () => {
    const db = await createTestDb();
    const id = await seedUser(db);
    const created = await createApiKey(db, id, "Old");
    await revokeApiKey(db, id, created!.id);
    expect(
      await classifyOgImage(db, id, `https://ogsmith.app/api/og?key=${created!.key}`, page)
    ).toBe("other_account");
  });

  it("keeps the first onboarding URL unless asked to overwrite it", async () => {
    const db = await createTestDb();
    const id = await seedUser(db);
    await saveOnboardingUrl(db, id, "https://first.example.com/");
    await saveOnboardingUrl(db, id, "https://second.example.com/");
    expect((await loadUser(db, id)).onboardingUrl).toBe("https://first.example.com/");
    await saveOnboardingUrl(db, id, "https://second.example.com/", { overwrite: true });
    expect((await loadUser(db, id)).onboardingUrl).toBe("https://second.example.com/");
  });
});

describe("activation emails", () => {
  const now = new Date("2026-10-11T09:00:00Z");
  beforeEach(() => vi.mocked(sendEmail).mockClear());

  it("nudges accounts stuck without a render between day 3 and day 7, once", async () => {
    const db = await createTestDb();
    const stuck = await seedUser(db, { createdAt: new Date(now.getTime() - 4 * DAY) });
    await seedUser(db, { createdAt: new Date(now.getTime() - 1 * DAY) }); // too early
    await seedUser(db, { createdAt: new Date(now.getTime() - 10 * DAY) }); // too late
    await seedUser(db, {
      createdAt: new Date(now.getTime() - 4 * DAY),
      firstRenderAt: new Date(now.getTime() - 3 * DAY),
    }); // already rendering

    expect(await runActivationEmails(db, now)).toEqual({ nudged: 1, reminded: 0 });
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      expect.objectContaining({ to: `${stuck}@t.dev` })
    );
    expect(await runActivationEmails(db, now)).toEqual({ nudged: 0, reminded: 0 });
  });

  it("reminds free accounts two days before the trial ends, but not paying ones", async () => {
    const db = await createTestDb();
    const ending = await seedUser(db, {
      createdAt: new Date(now.getTime() - 20 * DAY),
      firstRenderAt: now,
      trialEndsAt: new Date(now.getTime() + 1.5 * DAY),
    });
    const paying = await seedUser(db, {
      createdAt: new Date(now.getTime() - 20 * DAY),
      firstRenderAt: now,
      trialEndsAt: new Date(now.getTime() + 1.5 * DAY),
    });
    await db.update(subscriptions).set({ plan: "pro" }).where(eq(subscriptions.userId, paying));
    await seedUser(db, {
      createdAt: new Date(now.getTime() - 20 * DAY),
      firstRenderAt: now,
      trialEndsAt: new Date(now.getTime() + 6 * DAY),
    }); // not yet

    expect(await runActivationEmails(db, now)).toEqual({ nudged: 0, reminded: 1 });
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe(`${ending}@t.dev`);
    expect(call.subject).toBe("Your OGsmith trial ends in 2 days");
    expect(await runActivationEmails(db, now)).toEqual({ nudged: 0, reminded: 0 });
  });
});
