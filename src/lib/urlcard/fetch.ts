import { request as httpRequest, type IncomingMessage } from "http";
import { request as httpsRequest } from "https";
import type { LookupFunction } from "net";
import { checkUrl, SAFETY_MESSAGES, type SafetyFailure } from "./safety";

/**
 * Fetches caller-supplied URLs under strict limits.
 *
 * Two properties this has to get right, both of which rule out a plain
 * `fetch` call:
 *
 * 1. Redirects are followed by hand, because the safety check has to run
 *    again on every hop. A public URL that 302s to http://169.254.169.254/
 *    is the standard way past a check that only sees the URL it was given.
 *
 * 2. The connection is pinned to the address the check already validated,
 *    via Node's `lookup` hook. Otherwise the resolution that informed the
 *    decision and the resolution that opens the socket are two separate
 *    lookups, and a DNS record with a very short TTL can answer them
 *    differently — public for the check, internal for the connection. The
 *    hostname is still what goes in the Host header and TLS SNI, so
 *    certificate validation is unaffected.
 */

export const MAX_HTML_BYTES = 512 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 5_000;
export const MAX_REDIRECTS = 4;

/** Identifies us honestly, so sites can allow or block on sight. */
const USER_AGENT =
  "OGsmithBot/1.0 (+https://ogsmith.app/docs#url-to-card; link preview renderer)";

export type FetchFailure =
  | SafetyFailure
  | "too_many_redirects"
  | "timeout"
  | "http_error"
  | "too_large"
  | "wrong_type"
  | "network";

export const FETCH_MESSAGES: Record<FetchFailure, string> = {
  ...SAFETY_MESSAGES,
  too_many_redirects: "That URL redirected too many times.",
  timeout: "That page took too long to respond.",
  http_error: "That page returned an error.",
  too_large: "That page is too large to read.",
  wrong_type: "That URL didn't return a web page.",
  network: "That page couldn't be reached.",
};

export type FetchOk = {
  ok: true;
  /** The URL actually fetched, after redirects — used to resolve relatives. */
  finalUrl: string;
  contentType: string;
  body: Buffer;
};
export type FetchErr = { ok: false; reason: FetchFailure };
export type FetchResult = FetchOk | FetchErr;

export interface CheckVerdict {
  ok: boolean;
  reason?: FetchFailure;
  addresses?: string[];
}

interface FetchOptions {
  maxBytes: number;
  /** Whether the response's content-type is one we asked for. */
  expect?: (contentType: string) => boolean;
  /**
   * Whether a body that exceeds the cap is still usable. True for HTML,
   * where everything we want is in <head> and big pages are common —
   * nodejs.org and stripe.com both ship over 512KB, and failing on them
   * would mean failing on a good share of the web. False for images,
   * where half a file is no file.
   */
  truncate?: boolean;
  /**
   * ASCII marker that ends the interesting part of the body. Reading stops
   * as soon as it appears, so a huge page costs only its <head>.
   */
  stopAfter?: string;
  /**
   * Seam for tests, which need a reachable origin to exercise redirect,
   * size and content-type handling. Production callers never pass this, so
   * the real guard is what runs.
   */
  check?: (url: string) => Promise<CheckVerdict>;
}

/** Forces every connection attempt onto an address we already approved. */
function pinnedLookup(addresses: string[]): LookupFunction {
  return ((hostname, options, callback) => {
    const family = addresses[0].includes(":") ? 6 : 4;
    const cb = (typeof options === "function" ? options : callback) as (
      err: NodeJS.ErrnoException | null,
      address?: string | Array<{ address: string; family: number }>,
      family?: number
    ) => void;
    const all =
      typeof options === "object" && options !== null && options.all === true;
    if (all) {
      cb(
        null,
        addresses.map((address) => ({
          address,
          family: address.includes(":") ? 6 : 4,
        }))
      );
      return;
    }
    cb(null, addresses[0], family);
  }) as LookupFunction;
}

interface RawResponse {
  status: number;
  headers: IncomingMessage["headers"];
  stream: IncomingMessage;
}

function requestOnce(
  url: string,
  addresses: string[] | undefined
): Promise<
  | { ok: true; res: RawResponse }
  | { ok: false; reason: "timeout" | "network" | "too_large" }
> {
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return resolve({ ok: false, reason: "network" });
    }
    const isHttps = target.protocol === "https:";
    const send = isHttps ? httpsRequest : httpRequest;
    let settled = false;
    const finish = (
      value:
        | { ok: true; res: RawResponse }
        | { ok: false; reason: "timeout" | "network" | "too_large" }
    ) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const req = send(
      target,
      {
        method: "GET",
        // No connection pooling. A pooled socket is keyed by host:port and
        // outlives the validation that opened it, so reuse would quietly
        // skip the lookup hook on later requests. Each guarded fetch gets
        // its own connection instead.
        agent: false,
        // Pinning only applies when the caller validated addresses for us.
        ...(addresses && addresses.length > 0
          ? { lookup: pinnedLookup(addresses) }
          : {}),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5",
          // Identity keeps the byte cap meaningful: a compressed response
          // could otherwise expand far past it after decoding.
          "Accept-Encoding": "identity",
          Host: target.host,
        },
      },
      (res) => finish({ ok: true, res: { status: res.statusCode ?? 0, headers: res.headers, stream: res } })
    );

    req.setTimeout(FETCH_TIMEOUT_MS, () => {
      req.destroy();
      finish({ ok: false, reason: "timeout" });
    });
    req.on("error", () => finish({ ok: false, reason: "network" }));
    req.end();
  });
}

interface ReadResult {
  body: Buffer;
  /** True when the cap cut the body short. */
  truncated: boolean;
}

/**
 * Reads at most `limit` bytes, counting as they arrive. Content-Length is a
 * claim by the server, not a promise, and a chunked response makes no claim
 * at all, so the cap is enforced on the stream itself.
 *
 * Stops early once `stopAfter` appears, which for HTML means a multi-megabyte
 * page costs only the bytes up to </head>.
 */
function readCapped(
  stream: IncomingMessage,
  limit: number,
  stopAfter?: string
): Promise<ReadResult | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;
    // Carried between chunks so a marker split across a boundary is still
    // found.
    let tail = "";
    const overlap = stopAfter ? stopAfter.length : 0;
    const stop = (value: ReadResult | null) => {
      if (done) return;
      done = true;
      stream.destroy();
      resolve(value);
    };
    stream.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > limit) {
        // Keep the part that fits; the caller decides whether that is usable.
        const keep = chunk.subarray(0, Math.max(0, chunk.length - (total - limit)));
        chunks.push(keep);
        return stop({ body: Buffer.concat(chunks), truncated: true });
      }
      chunks.push(chunk);
      if (stopAfter) {
        const text = tail + chunk.toString("latin1");
        if (text.includes(stopAfter)) {
          return stop({ body: Buffer.concat(chunks), truncated: false });
        }
        tail = text.slice(-overlap);
      }
    });
    stream.on("end", () => stop({ body: Buffer.concat(chunks), truncated: false }));
    stream.on("error", () => stop(null));
    stream.on("aborted", () => stop(null));
  });
}

export async function safeFetch(
  rawUrl: string,
  options: FetchOptions
): Promise<FetchResult> {
  const check =
    options.check ??
    (async (u: string): Promise<CheckVerdict> => {
      const r = await checkUrl(u);
      return { ok: r.ok, reason: r.reason, addresses: r.addresses };
    });

  let url = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const verdict = await check(url);
    if (!verdict.ok) {
      return { ok: false, reason: verdict.reason ?? "blocked_address" };
    }

    const attempt = await requestOnce(url, verdict.addresses);
    if (!attempt.ok) return { ok: false, reason: attempt.reason };
    const { status, headers, stream } = attempt.res;

    if (status >= 300 && status < 400) {
      const location = headers.location;
      stream.resume();
      stream.destroy();
      if (!location) return { ok: false, reason: "http_error" };
      try {
        // Resolved against the current URL so relative redirects work, then
        // re-checked at the top of the next iteration.
        url = new URL(location, url).toString();
      } catch {
        return { ok: false, reason: "bad_url" };
      }
      continue;
    }

    if (status < 200 || status >= 300) {
      stream.resume();
      stream.destroy();
      return { ok: false, reason: "http_error" };
    }

    const contentType = (headers["content-type"] ?? "").toString().toLowerCase();
    if (options.expect && !options.expect(contentType)) {
      stream.resume();
      stream.destroy();
      return { ok: false, reason: "wrong_type" };
    }

    const read = await readCapped(stream, options.maxBytes, options.stopAfter);
    if (read === null) return { ok: false, reason: "network" };
    if (read.truncated && !options.truncate) {
      return { ok: false, reason: "too_large" };
    }
    return { ok: true, finalUrl: url, contentType, body: read.body };
  }
  return { ok: false, reason: "too_many_redirects" };
}

export function fetchHtml(url: string): Promise<FetchResult> {
  return safeFetch(url, {
    maxBytes: MAX_HTML_BYTES,
    expect: (ct) => ct.includes("text/html") || ct.includes("xhtml") || ct === "",
    // Card metadata lives in <head>; the rest of a page is not worth
    // reading, and a page bigger than the cap is still perfectly usable.
    stopAfter: "</head",
    truncate: true,
  });
}

export function fetchImage(url: string): Promise<FetchResult> {
  return safeFetch(url, {
    maxBytes: MAX_IMAGE_BYTES,
    expect: (ct) => ct.startsWith("image/") || ct === "",
  });
}
