import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { users } from "./db/schema";
import { MAX_LOGO_DATA_URL_LENGTH, validateLogoDataUrl } from "./brand";
import { attr, decodeEntities, headOf } from "./urlcard/extract";
import { fetchHtml, fetchImage, type FetchResult } from "./urlcard/fetch";

/**
 * Guesses a site's brand from its own <head>: the name it gives itself, the
 * colour it asks browsers to paint their chrome, and its touch icon. New
 * accounts get these as brand defaults so the first card they see already
 * looks like theirs.
 *
 * Every value is a suggestion that only fills empty fields. Nothing here is
 * trusted as markup: names are plain text, colours must parse as hex, and a
 * logo must be a small PNG, JPEG or GIF by its own magic bytes.
 */

export interface BrandHints {
  site: string | null;
  accent: string | null;
  /** Absolute URLs, best first. */
  logoCandidates: string[];
}

export interface DetectedBrand {
  site: string | null;
  accent: string | null;
  /** A data URL ready for users.brandLogo, or null. */
  logo: string | null;
}

const MAX_SITE = 100;
const LINK_TAG = /<link\b[^>]*>/gi;
const META_TAG = /<meta\b[^>]*>/gi;

function metaContent(head: string, ...names: string[]): string | null {
  const wanted = names.map((n) => n.toLowerCase());
  for (const name of wanted) {
    for (const tag of head.match(META_TAG) ?? []) {
      const key = (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase();
      if (key !== name) continue;
      const content = attr(tag, "content");
      if (content && content.trim()) return decodeEntities(content).trim();
    }
  }
  return null;
}

/** "#abc" and "#AABBCC" both become "#aabbcc"; anything else is null. */
export function normalizeHex(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return null;
}

/**
 * A theme colour is often plain white or black, which says nothing about the
 * brand and would make an invisible accent. Those, and greys, are dropped.
 */
export function usableAccent(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (l > 0.9 || l < 0.1) return false;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return s >= 0.2;
}

function largestSize(sizes: string | null): number {
  if (!sizes) return 0;
  let best = 0;
  for (const m of sizes.matchAll(/(\d+)x(\d+)/gi)) best = Math.max(best, Number(m[1]));
  return best;
}

export function extractBrandHints(html: string, pageUrl: string): BrandHints {
  const head = headOf(html);

  const rawSite = metaContent(head, "og:site_name", "application-name", "apple-mobile-web-app-title");
  let site = rawSite ? rawSite.replace(/\s+/g, " ").slice(0, MAX_SITE) : null;
  if (!site) {
    try {
      site = new URL(pageUrl).hostname.replace(/^www\./, "") || null;
    } catch {
      site = null;
    }
  }

  const accentCandidates: (string | null)[] = [
    metaContent(head, "theme-color"),
    metaContent(head, "msapplication-tilecolor"),
  ];
  const icons: { href: string; rank: number; size: number }[] = [];
  for (const tag of head.match(LINK_TAG) ?? []) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    const href = attr(tag, "href");
    if (rel.includes("mask-icon")) accentCandidates.push(attr(tag, "color"));
    if (!href) continue;
    const type = (attr(tag, "type") ?? "").toLowerCase();
    // SVG and ICO can't be stored as a logo, so they aren't worth fetching.
    if (type.includes("svg") || /\.(svg|ico)(\?|#|$)/i.test(href)) continue;
    const size = largestSize(attr(tag, "sizes"));
    if (rel.includes("apple-touch-icon") || rel.includes("apple-touch-icon-precomposed")) {
      icons.push({ href, rank: 0, size });
    } else if (rel.includes("icon")) {
      icons.push({ href, rank: 1, size });
    }
  }

  const accent =
    accentCandidates.map(normalizeHex).find((h): h is string => h !== null && usableAccent(h)) ??
    null;

  // Touch icons first (they're made to be shown large), bigger before smaller.
  icons.sort((a, b) => a.rank - b.rank || b.size - a.size);
  const logoCandidates: string[] = [];
  for (const icon of icons) {
    try {
      const abs = new URL(decodeEntities(icon.href.trim()), pageUrl).toString();
      if (!logoCandidates.includes(abs)) logoCandidates.push(abs);
    } catch {
      /* skip unparseable hrefs */
    }
  }
  try {
    // Most sites serve one here even when the head doesn't mention it.
    const fallback = new URL("/apple-touch-icon.png", pageUrl).toString();
    if (!logoCandidates.includes(fallback)) logoCandidates.push(fallback);
  } catch {
    /* no fallback for a bad page URL */
  }

  return { site, accent, logoCandidates: logoCandidates.slice(0, 4) };
}

/** The stored-logo formats, recognised by their first bytes. */
export function sniffImageType(body: Buffer): "png" | "jpeg" | "gif" | null {
  if (body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "jpeg";
  if (body.length >= 6 && /^GIF8[79]a$/.test(body.subarray(0, 6).toString("latin1"))) return "gif";
  return null;
}

export function toLogoDataUrl(body: Buffer): string | null {
  const type = sniffImageType(body);
  if (!type) return null;
  const dataUrl = `data:image/${type};base64,${body.toString("base64")}`;
  if (dataUrl.length > MAX_LOGO_DATA_URL_LENGTH) return null;
  return validateLogoDataUrl(dataUrl).ok ? dataUrl : null;
}

export interface BrandFetchers {
  html: (url: string) => Promise<FetchResult>;
  image: (url: string) => Promise<FetchResult>;
}

const defaultFetchers: BrandFetchers = { html: fetchHtml, image: fetchImage };

/** Reads a page and its icon. Returns null when the page can't be read. */
export async function detectBrand(
  pageUrl: string,
  fetchers: BrandFetchers = defaultFetchers
): Promise<DetectedBrand | null> {
  const page = await fetchers.html(pageUrl);
  if (!page.ok) return null;
  const hints = extractBrandHints(page.body.toString("utf8"), page.finalUrl);
  let logo: string | null = null;
  for (const candidate of hints.logoCandidates) {
    const img = await fetchers.image(candidate);
    if (!img.ok) continue;
    logo = toLogoDataUrl(img.body);
    if (logo) break;
  }
  return { site: hints.site, accent: hints.accent, logo };
}

type BrandRow = Pick<
  typeof users.$inferSelect,
  | "id"
  | "brandTemplate"
  | "brandTheme"
  | "brandAccent"
  | "brandSite"
  | "brandLogo"
  | "brandUpdatedAt"
  | "liveAt"
>;

/**
 * True for an account whose brand nobody has touched yet and whose cards
 * aren't on a live page, so filling in defaults can't change a card that
 * platforms have already cached.
 */
export function brandIsUntouched(user: BrandRow): boolean {
  return (
    !user.liveAt &&
    !user.brandUpdatedAt &&
    !user.brandTemplate &&
    !user.brandTheme &&
    !user.brandAccent &&
    !user.brandSite &&
    !user.brandLogo
  );
}

/**
 * Saves what was detected into the empty brand fields. The cache version is
 * deliberately left alone: there's nothing published to refresh yet.
 */
export async function applyDetectedBrand(
  db: Database,
  user: BrandRow,
  detected: DetectedBrand
): Promise<boolean> {
  const update: Partial<typeof users.$inferInsert> = {};
  if (!user.brandSite && detected.site) update.brandSite = detected.site;
  if (!user.brandAccent && detected.accent) update.brandAccent = detected.accent;
  if (!user.brandLogo && detected.logo) update.brandLogo = detected.logo;
  if (Object.keys(update).length === 0) return false;
  await db.update(users).set(update).where(eq(users.id, user.id));
  return true;
}
