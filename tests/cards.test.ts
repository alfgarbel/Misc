import { describe, it, expect } from "vitest";
import { users } from "@/lib/db/schema";
import {
  cardKeyOf,
  cardRequest,
  crawlerName,
  getCard,
  listCards,
  recordCard,
  timeAgo,
} from "@/lib/cards";
import { createTestDb } from "./helpers";

const q = (s: string) => new URLSearchParams(s);

async function setup() {
  const db = await createTestDb();
  await db.insert(users).values({ id: "u1", email: "u1@t.dev", passwordHash: "x" });
  return db;
}

describe("which card a request is", () => {
  it("drops credentials and cache busting, and sorts what's left", () => {
    expect(cardRequest(q("title=Hi&key=og_secret&v=3&acct=u1&sig=abc&template=bold"))).toBe(
      "template=bold&title=Hi"
    );
  });

  it("keys a ?url= card by the page, so a new title updates the same row", () => {
    expect(cardKeyOf(q("url=https://a.test/x&title=One"))).toBe(
      cardKeyOf(q("url=https://a.test/x&title=Two&key=og_other"))
    );
    expect(cardKeyOf(q("k=post-1&title=One"))).toBe(cardKeyOf(q("k=post-1&title=Two")));
    expect(cardKeyOf(q("title=One"))).not.toBe(cardKeyOf(q("title=Two")));
    expect(cardKeyOf(q("title=One&sig=x"))).toBe(cardKeyOf(q("title=One&sig=y")));
  });

  it("names the platform behind a crawler", () => {
    expect(crawlerName("Twitterbot/1.0")).toBe("X");
    expect(crawlerName("LinkedInBot/1.0 (compatible; Mozilla/5.0)")).toBe("LinkedIn");
    expect(crawlerName("WhatsApp/2.23.20.0")).toBe("WhatsApp");
    expect(crawlerName("facebookexternalhit/1.1")).toBe("Facebook");
    expect(crawlerName("Mozilla/5.0 (Macintosh) Safari/605.1.15")).toBeNull();
    expect(crawlerName(null)).toBeNull();
  });
});

describe("recording cards", () => {
  it("counts renders and keeps the last crawler that came by", async () => {
    const db = await setup();
    const sent = q("key=og_x&url=https://a.test/post");
    const t0 = new Date("2026-10-01T10:00:00Z");
    const t1 = new Date("2026-10-01T11:00:00Z");
    const t2 = new Date("2026-10-01T12:00:00Z");
    await recordCard(db, { userId: "u1", sent, title: "Post", userAgent: "LinkedInBot/1.0", now: t0 });
    await recordCard(db, { userId: "u1", sent, title: "Post, edited", userAgent: "Chrome", now: t1 });
    await recordCard(db, { userId: "u1", sent, error: "Couldn't read the page", now: t2 });

    const [row] = await listCards(db, "u1");
    expect(row.renders).toBe(2);
    expect(row.title).toBe("Post, edited");
    expect(row.error).toBe("Couldn't read the page");
    expect(row.lastCrawler).toBe("LinkedIn");
    expect(row.lastCrawledAt).toEqual(t0);
    expect(row.lastSeenAt).toEqual(t2);
    expect(row.request).toBe("url=https%3A%2F%2Fa.test%2Fpost");
    expect(row.request).not.toContain("og_x");

    await recordCard(db, { userId: "u1", sent, title: "Post, edited", now: t2 });
    expect((await getCard(db, "u1", row.cardKey))?.error).toBeNull();
  });

  it("lists newest first and only the account's own cards", async () => {
    const db = await setup();
    await db.insert(users).values({ id: "u2", email: "u2@t.dev", passwordHash: "x" });
    await recordCard(db, { userId: "u1", sent: q("title=Old"), title: "Old", now: new Date(1000) });
    await recordCard(db, { userId: "u1", sent: q("title=New"), title: "New", now: new Date(2000) });
    await recordCard(db, { userId: "u2", sent: q("title=Theirs"), now: new Date(3000) });
    expect((await listCards(db, "u1")).map((r) => r.title)).toEqual(["New", "Old"]);
    expect(await getCard(db, "u2", cardKeyOf(q("title=New")))).toBeNull();
  });

  it("never throws when the table isn't there yet", async () => {
    const db = await setup();
    await db.run("DROP TABLE cards");
    await expect(recordCard(db, { userId: "u1", sent: q("title=x") })).resolves.toBeUndefined();
    expect(await listCards(db, "u1")).toEqual([]);
  });
});

describe("timeAgo", () => {
  it("rounds down to the largest unit", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    expect(timeAgo(new Date("2026-10-11T11:59:30Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-10-11T11:00:00Z"), now)).toBe("1 hour ago");
    expect(timeAgo(new Date("2026-10-08T12:00:00Z"), now)).toBe("3 days ago");
  });
});
