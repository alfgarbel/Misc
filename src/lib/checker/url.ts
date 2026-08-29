/**
 * Turns what a person types into a URL, or gives up cleanly.
 *
 * People type "ogsmith.app". A native type="url" field rejects that with
 * "please enter a URL" before anything reaches the server, which is a dead
 * end at the very first interaction of a tool whose whole job is to be
 * pasted into. So the field takes text and this decides what was meant.
 *
 * Guessing is deliberately narrow: a bare word like "banana" would become
 * https://banana, which resolves to nothing and produces a worse error
 * than saying so up front.
 */

const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
/** Something with at least one dot and no spaces — i.e. a hostname. */
const LOOKS_LIKE_HOST =
  /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+(:\d+)?([/?#].*)?$/;
/** Allowed through so the safety guard can give its own clearer refusal. */
const LOCALHOST = /^localhost(:\d+)?([/?#].*)?$/i;

export function coerceUrl(input: string): string | null {
  // Pasted URLs arrive wrapped in quotes or angle brackets more often than
  // you would think — from a chat client, an email, or a code sample.
  const raw = input.trim().replace(/^[<"'\s]+/, "").replace(/[>"'\s]+$/, "");
  if (!raw || /\s/.test(raw)) return null;

  // Protocol-relative, as copied out of markup.
  let candidate = raw.startsWith("//") ? `https:${raw}` : raw;

  if (!HAS_SCHEME.test(candidate)) {
    if (!LOOKS_LIKE_HOST.test(candidate) && !LOCALHOST.test(candidate)) {
      return null;
    }
    candidate = `https://${candidate}`;
  }

  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u.toString();
  } catch {
    return null;
  }
}
