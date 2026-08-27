import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Guards outbound fetches of caller-supplied URLs.
 *
 * The render endpoint runs inside our infrastructure, so a URL parameter is
 * an invitation to make us issue requests on the caller's behalf: at cloud
 * metadata services, at internal admin panels, at anything bound to
 * localhost. Every check here exists because some shape of that attack
 * would otherwise work.
 *
 * The rule that matters most: names are resolved and the *resolved
 * addresses* are checked, and that check is repeated on every redirect hop.
 * Validating the hostname alone is defeated by a DNS record that simply
 * points at 127.0.0.1, and validating only the first hop is defeated by a
 * redirect.
 */

export type SafetyFailure =
  | "bad_url"
  | "bad_scheme"
  | "has_credentials"
  | "blocked_host"
  | "blocked_address"
  | "dns_failed";

export interface SafetyResult {
  ok: boolean;
  reason?: SafetyFailure;
  /** Addresses the hostname resolved to, so the fetch can pin to them. */
  addresses?: string[];
}

/** A caller never needs to know which internal address a name resolved to. */
export const SAFETY_MESSAGES: Record<SafetyFailure, string> = {
  bad_url: "That doesn't look like a valid URL.",
  bad_scheme: "Only http:// and https:// URLs can be fetched.",
  has_credentials: "URLs with embedded credentials aren't accepted.",
  blocked_host: "That hostname can't be fetched.",
  blocked_address: "That URL resolves to a network address we don't fetch.",
  dns_failed: "That hostname couldn't be resolved.",
};

/** Hostnames that never refer to anything a public fetch should reach. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  // Cloud metadata services, which answer on a well-known name as well as
  // a well-known address.
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

/** Suffixes reserved for private networks or documentation. */
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    // Reject anything non-canonical: leading zeros invite octal confusion
    // between our parser and the resolver's.
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith("0")) return null;
    const v = Number(part);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

function inRange(ip: number, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (baseInt & mask);
}

/** Everything that isn't a public, routable IPv4 destination. */
const BLOCKED_V4 = [
  "0.0.0.0/8", // "this network"
  "10.0.0.0/8", // RFC1918
  "100.64.0.0/10", // CGNAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local, incl. 169.254.169.254 metadata
  "172.16.0.0/12", // RFC1918
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // TEST-NET-1
  "192.88.99.0/24", // 6to4 relay anycast
  "192.168.0.0/16", // RFC1918
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved, includes 255.255.255.255
];

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable means unverifiable
  return BLOCKED_V4.some((cidr) => inRange(n, cidr));
}

function expandIpv6(ip: string): string[] | null {
  const zone = ip.indexOf("%");
  const bare = (zone === -1 ? ip : ip.slice(0, zone)).toLowerCase();
  const halves = bare.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 2) {
    if (fill < 0) return null;
    return [...head, ...Array(fill).fill("0"), ...tail];
  }
  return head.length === 8 ? head : null;
}

function isBlockedIpv6(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "");
  // ::ffff:127.0.0.1 and ::127.0.0.1 are loopback wearing an IPv6 coat.
  const mapped = bare.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return isBlockedIpv4(mapped[1]);

  const groups = expandIpv6(bare);
  if (!groups) return true;
  const values = groups.map((g) => parseInt(g || "0", 16));
  if (values.some((v) => Number.isNaN(v))) return true;

  const allZero = values.every((v) => v === 0);
  if (allZero) return true; // ::
  if (values.slice(0, 7).every((v) => v === 0) && values[7] === 1) return true; // ::1

  const first = values[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (first === 0x2001 && values[1] === 0x0db8) return true; // 2001:db8::/32 docs

  // ::ffff:0:0/96 in group form.
  if (values.slice(0, 5).every((v) => v === 0) && values[5] === 0xffff) {
    const a = (values[6] >> 8) & 0xff;
    const b = values[6] & 0xff;
    const c = (values[7] >> 8) & 0xff;
    const d = values[7] & 0xff;
    return isBlockedIpv4(`${a}.${b}.${c}.${d}`);
  }
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  // A bracketed or zoned form that isIP rejects still deserves inspection
  // rather than a pass.
  return isBlockedIpv6(ip);
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  return BLOCKED_SUFFIXES.some((suffix) => h.endsWith(suffix));
}

/**
 * Validates one URL and resolves it. Call this for the initial URL *and*
 * for every redirect target.
 */
export async function checkUrl(
  raw: string,
  resolver: (host: string) => Promise<string[]> = defaultResolve
): Promise<SafetyResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "bad_url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "bad_scheme" };
  }
  // Credentials in a URL are how an SSRF becomes an authenticated SSRF.
  if (url.username || url.password) {
    return { ok: false, reason: "has_credentials" };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) return { ok: false, reason: "bad_url" };
  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: "blocked_host" };
  }

  // A literal address needs no resolution, but still needs checking.
  if (isIP(hostname) !== 0) {
    if (isBlockedAddress(hostname)) {
      return { ok: false, reason: "blocked_address" };
    }
    return { ok: true, addresses: [hostname] };
  }

  let addresses: string[];
  try {
    addresses = await resolver(hostname);
  } catch {
    return { ok: false, reason: "dns_failed" };
  }
  if (addresses.length === 0) return { ok: false, reason: "dns_failed" };
  // Every answer must be safe. One bad record is enough to reject the host —
  // otherwise a round-robin between a public and a private address would be
  // a coin flip.
  if (addresses.some((a) => isBlockedAddress(a))) {
    return { ok: false, reason: "blocked_address" };
  }
  return { ok: true, addresses };
}

async function defaultResolve(host: string): Promise<string[]> {
  const results = await lookup(host, { all: true, verbatim: true });
  return results.map((r) => r.address);
}
