import { sniffAsset } from "../assets";
import { fetchImage, MAX_IMAGE_BYTES } from "./fetch";

/**
 * Fetches a page's own og:image for use inside a card.
 *
 * The URL comes from a third-party page, so it is exactly as untrusted as
 * the one the caller supplied: it goes through the same guard, and the
 * bytes are identified by their own signature before anything tries to
 * decode them. A file that claims to be a PNG and is not would otherwise
 * reach the renderer's image decoder.
 */

interface CachedImage {
  dataUrl: string | null;
  at: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 128;
const cache = new Map<string, CachedImage>();

/** Only used by tests, so one case can't see another's cached image. */
export function clearHeroImageCache() {
  cache.clear();
}

function remember(url: string, dataUrl: string | null): string | null {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(url, { dataUrl, at: Date.now() });
  return dataUrl;
}

/**
 * Returns a data URL for the image, or null if it can't be used. Never
 * throws and never explains why: a missing hero image degrades the card,
 * it doesn't fail the render.
 */
export async function loadHeroImage(url: string | null): Promise<string | null> {
  if (!url) return null;

  const hit = cache.get(url);
  // Failures are cached too, so a broken image isn't refetched on every
  // render of the same card.
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.dataUrl;

  const res = await fetchImage(url);
  if (!res.ok) return remember(url, null);

  const sniff = sniffAsset(res.body, MAX_IMAGE_BYTES);
  if (!sniff.ok || sniff.kind !== "image") return remember(url, null);

  return remember(
    url,
    `data:${sniff.mimeType};base64,${res.body.toString("base64")}`
  );
}
