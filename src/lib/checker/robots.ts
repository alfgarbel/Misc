import { safeFetch, MAX_HTML_BYTES } from "../urlcard/fetch";
import type { FetchResult } from "../urlcard/fetch";

/**
 * A deliberately small robots.txt reader.
 *
 * One person checking one page is a visit. The same code pointed at five
 * hundred domains is a crawl, and a crawl that ignores robots.txt is the
 * kind of thing that gets a sending domain blocked — which costs far more
 * than the handful of prospects it skips.
 *
 * It implements the parts that are unambiguous and settled: User-agent
 * grouping, Disallow, Allow, and longest-match-wins. Crawl-delay,
 * wildcards and sitemap lines are ignored. Anything it cannot understand
 * is treated as permission, matching how every real crawler behaves — the
 * file is advisory, and a parse failure is not a prohibition.
 */

export interface RobotsRules {
  /** Path prefixes this agent may not fetch. */
  disallow: string[];
  /** Prefixes that carve exceptions out of the above. */
  allow: string[];
}

/** Our crawler's token, matched case-insensitively against User-agent. */
export const ROBOTS_AGENT = "ogsmithbot";

export function parseRobots(text: string, agent = ROBOTS_AGENT): RobotsRules {
  const specific: RobotsRules = { disallow: [], allow: [] };
  const wildcard: RobotsRules = { disallow: [], allow: [] };

  // Which groups the current line belongs to. Consecutive User-agent lines
  // share one group of rules, which is why these are sets rather than a
  // single value.
  let inSpecific = false;
  let inWildcard = false;
  let readingAgents = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === "user-agent") {
      // A new group starts at the first agent line after any rule line.
      if (!readingAgents) {
        inSpecific = false;
        inWildcard = false;
        readingAgents = true;
      }
      const ua = value.toLowerCase();
      if (ua === "*") inWildcard = true;
      else if (ua === agent) inSpecific = true;
      continue;
    }

    if (field !== "disallow" && field !== "allow") continue;
    readingAgents = false;

    const targets: RobotsRules[] = [];
    if (inSpecific) targets.push(specific);
    if (inWildcard) targets.push(wildcard);
    for (const t of targets) {
      // "Disallow:" with no value means no restriction at all.
      if (field === "disallow" && value === "") continue;
      t[field].push(value);
    }
  }

  // A group naming us explicitly replaces the wildcard group entirely,
  // rather than adding to it.
  return specific.disallow.length > 0 || specific.allow.length > 0
    ? specific
    : wildcard;
}

/** Longest matching rule wins; Allow beats Disallow at equal length. */
export function robotsAllows(rules: RobotsRules, pathname: string): boolean {
  const longest = (list: string[]) =>
    list
      .filter((p) => p !== "" && pathname.startsWith(p))
      .reduce((best, p) => (p.length > best ? p.length : best), 0);

  const blocked = longest(rules.disallow);
  if (blocked === 0) return true;
  return longest(rules.allow) >= blocked;
}

interface CachedRobots {
  rules: RobotsRules;
  at: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, CachedRobots>();

/** Tests only. */
export function clearRobotsCache() {
  cache.clear();
}

/**
 * Whether robots.txt permits fetching this URL. Fetched once per origin.
 *
 * Returns true when the file is missing, unreadable or unparseable —
 * absence of a rule is permission, and treating a 404 as a refusal would
 * skip most of the web.
 */
export async function robotsAllowsUrl(
  rawUrl: string,
  deps: {
    fetchRobots?: (url: string) => Promise<FetchResult>;
    now?: () => number;
  } = {}
): Promise<boolean> {
  const fetchRobots =
    deps.fetchRobots ??
    ((u: string) =>
      safeFetch(u, {
        maxBytes: MAX_HTML_BYTES,
        truncate: true,
      }));
  const now = deps.now ?? Date.now;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  const origin = url.origin;

  const hit = cache.get(origin);
  if (hit && now() - hit.at < CACHE_TTL_MS) {
    return robotsAllows(hit.rules, url.pathname);
  }

  let rules: RobotsRules = { disallow: [], allow: [] };
  try {
    const res = await fetchRobots(`${origin}/robots.txt`);
    if (res.ok) rules = parseRobots(res.body.toString("utf8"));
  } catch {
    /* unreachable robots.txt is not a refusal */
  }
  cache.set(origin, { rules, at: now() });
  return robotsAllows(rules, url.pathname);
}
