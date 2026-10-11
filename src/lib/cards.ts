import { createHash } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "./db";
import { cards, type CardRow } from "./db/schema";

/**
 * The account's list of cards: one row per page (or per set of parameters)
 * that /api/og has drawn, with the last problem it hit and the last social
 * platform that fetched it. It answers the question people actually have
 * after pasting the tag: "is this working on my site?"
 *
 * Recording never throws. Until the migration that adds the table has run,
 * writes are dropped and reads come back empty.
 */

/** Parameters that authenticate or bust caches, never part of the card. */
const NOT_THE_CARD = new Set(["key", "acct", "sig", "v"]);
const MAX_REQUEST = 2000;
const MAX_TITLE = 300;
const MAX_ERROR = 300;

/** The request without credentials, sorted so equal requests compare equal. */
export function cardRequest(params: URLSearchParams): string {
  const kept = [...params.entries()]
    .filter(([k]) => !NOT_THE_CARD.has(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return new URLSearchParams(kept).toString().slice(0, MAX_REQUEST);
}

/**
 * Which card a request is. A page read with ?url= is that page, whatever
 * else changes; ?k= names a page explicitly; otherwise the parameters are
 * the card. Titles are deliberately not the key when a URL or k is there,
 * so editing a headline updates the row instead of adding one.
 */
export function cardKeyOf(params: URLSearchParams): string {
  const url = params.get("url");
  const k = params.get("k");
  const id = url ? `url:${url}` : k ? `k:${k}` : `q:${cardRequest(params)}`;
  return createHash("sha256").update(id).digest("hex").slice(0, 32);
}

const CRAWLERS: [RegExp, string][] = [
  [/Twitterbot/i, "X"],
  [/LinkedInBot/i, "LinkedIn"],
  [/WhatsApp/i, "WhatsApp"],
  [/facebookexternalhit|facebookcatalog|meta-externalagent|Facebot/i, "Facebook"],
  [/Slackbot|Slack-ImgProxy/i, "Slack"],
  [/Discordbot/i, "Discord"],
  [/TelegramBot/i, "Telegram"],
  [/Applebot/i, "Apple"],
  [/SkypeUriPreview/i, "Teams"],
  [/redditbot/i, "Reddit"],
  [/Pinterestbot/i, "Pinterest"],
  [/Bluesky|Cardyb/i, "Bluesky"],
  [/Mastodon/i, "Mastodon"],
  [/Embedly|Iframely/i, "an embed service"],
  [/vkShare/i, "VK"],
];

/** The platform behind a crawler's user agent, or null for anyone else. */
export function crawlerName(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  for (const [re, name] of CRAWLERS) if (re.test(userAgent)) return name;
  return null;
}

export interface CardVisit {
  userId: string;
  /** The parameters as the caller sent them. */
  sent: URLSearchParams;
  /** The title the card ended up with, after reading the page. */
  title?: string | null;
  /** Why the card couldn't be drawn, or null when it was. */
  error?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export async function recordCard(db: Database, visit: CardVisit): Promise<void> {
  const now = visit.now ?? new Date();
  const crawler = crawlerName(visit.userAgent);
  const title = visit.title?.slice(0, MAX_TITLE) ?? null;
  const error = visit.error?.slice(0, MAX_ERROR) ?? null;
  const request = cardRequest(visit.sent);
  try {
    await db
      .insert(cards)
      .values({
        userId: visit.userId,
        cardKey: cardKeyOf(visit.sent),
        pageUrl: visit.sent.get("url")?.slice(0, MAX_REQUEST) ?? null,
        title,
        request,
        error,
        renders: error ? 0 : 1,
        firstSeenAt: now,
        lastSeenAt: now,
        lastCrawler: crawler,
        lastCrawledAt: crawler ? now : null,
      })
      .onConflictDoUpdate({
        target: [cards.userId, cards.cardKey],
        set: {
          request,
          error,
          lastSeenAt: now,
          // A failed attempt keeps the last good title.
          ...(error ? {} : { title, renders: sql`${cards.renders} + 1` }),
          ...(crawler ? { lastCrawler: crawler, lastCrawledAt: now } : {}),
        },
      });
  } catch (err) {
    console.error("[cards] could not record a card:", err);
  }
}

export async function listCards(db: Database, userId: string, limit = 50): Promise<CardRow[]> {
  try {
    return await db
      .select()
      .from(cards)
      .where(eq(cards.userId, userId))
      .orderBy(desc(cards.lastSeenAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export async function getCard(
  db: Database,
  userId: string,
  cardKey: string
): Promise<CardRow | null> {
  try {
    const rows = await db
      .select()
      .from(cards)
      .where(and(eq(cards.userId, userId), eq(cards.cardKey, cardKey)))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** "just now", "5 minutes ago", "3 days ago". Coarse on purpose. */
export function timeAgo(then: Date, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  const units: [number, string][] = [
    [86400 * 30, "month"],
    [86400 * 7, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    const n = Math.floor(s / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? "" : "s"} ago`;
  }
  return "just now";
}
