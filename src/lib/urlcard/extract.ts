/**
 * Pulls card metadata out of a page's HTML.
 *
 * Deliberately a focused scanner rather than a DOM parser: the fields we
 * want all live in <head> as meta tags, and a scanner has no appetite for
 * malformed markup the way a real parser has to. Everything extracted is
 * bounded and used as text, never as markup.
 */

export interface PageMetadata {
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  /** Hostname of the final URL, a good default when no site name is given. */
  domain: string;
  url: string;
}

export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 300;
export const MAX_SITE = 100;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  eacute: "é",
  egrave: "è",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  ccedil: "ç",
  ntilde: "ñ",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body: string) => {
    if (body.startsWith("#")) {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

function clean(value: string | null, max: number): string | null {
  if (value === null) return null;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Only the head is scanned; body content is not card metadata. */
function headOf(html: string): string {
  const end = html.search(/<\/head\s*>/i);
  // Some pages omit </head>; cap the scan so a huge body isn't walked.
  return end === -1 ? html.slice(0, 200_000) : html.slice(0, end);
}

const META_TAG = /<meta\b[^>]*>/gi;

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

/** Every meta tag's key (name or property) mapped to its content. */
function metaMap(head: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const tag of head.match(META_TAG) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase();
    const content = attr(tag, "content");
    if (!key || content === null) continue;
    // First occurrence wins, matching how crawlers treat duplicates.
    if (!map.has(key)) map.set(key, content);
  }
  return map;
}

function titleTag(head: string): string | null {
  const m = head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return m ? m[1] : null;
}

/**
 * Extracts card fields, preferring OpenGraph, then Twitter cards, then
 * ordinary head tags — the same order social crawlers use.
 */
export function extractMetadata(html: string, finalUrl: string): PageMetadata {
  const head = headOf(html);
  const meta = metaMap(head);
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = meta.get(k);
      if (v !== undefined && v.trim() !== "") return v;
    }
    return null;
  };

  let domain = "";
  let base = finalUrl;
  try {
    const u = new URL(finalUrl);
    domain = u.hostname.replace(/^www\./, "");
    base = u.toString();
  } catch {
    /* keep the raw string; callers only display it */
  }

  const rawImage = pick("og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src");
  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      // Pages routinely give a path rather than an absolute URL.
      imageUrl = new URL(decodeEntities(rawImage.trim()), base).toString();
    } catch {
      imageUrl = null;
    }
  }

  return {
    title:
      clean(pick("og:title", "twitter:title"), MAX_TITLE) ??
      clean(titleTag(head), MAX_TITLE),
    description: clean(
      pick("og:description", "twitter:description", "description"),
      MAX_DESCRIPTION
    ),
    siteName: clean(pick("og:site_name", "application-name"), MAX_SITE),
    imageUrl,
    domain,
    url: base,
  };
}
