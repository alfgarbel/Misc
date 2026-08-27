import { sniffAsset } from "../assets";
import { fetchImage, MAX_IMAGE_BYTES } from "./fetch";
import { imageDimensions } from "./dimensions";

/**
 * Fetches a page's own og:image for use inside a card.
 *
 * The URL comes from a third-party page, so it is exactly as untrusted as
 * the one the caller supplied: it goes through the same guard, and the
 * bytes are identified by their own signature before anything tries to
 * decode them. A file that claims to be a PNG and is not would otherwise
 * reach the renderer's image decoder.
 */

/** What the layout needs: the bytes, and the shape to place them in. */
export interface HeroImage {
  dataUrl: string;
  /** Null when the header couldn't be read; the caller then avoids
   *  any layout choice that depends on knowing the aspect ratio. */
  width: number | null;
  height: number | null;
}

interface CachedImage {
  hero: HeroImage | null;
  at: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 128;
const cache = new Map<string, CachedImage>();

/** Only used by tests, so one case can't see another's cached image. */
export function clearHeroImageCache() {
  cache.clear();
}

function remember(url: string, hero: HeroImage | null): HeroImage | null {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(url, { hero, at: Date.now() });
  return hero;
}

/**
 * Returns the image and its shape, or null if it can't be used. Never
 * throws and never explains why: a missing hero image degrades the card,
 * it doesn't fail the render.
 */
export async function loadHeroImage(
  url: string | null
): Promise<HeroImage | null> {
  if (!url) return null;

  const hit = cache.get(url);
  // Failures are cached too, so a broken image isn't refetched on every
  // render of the same card.
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.hero;

  const res = await fetchImage(url);
  if (!res.ok) return remember(url, null);

  const sniff = sniffAsset(res.body, MAX_IMAGE_BYTES);
  if (!sniff.ok || sniff.kind !== "image") return remember(url, null);

  const dims = imageDimensions(res.body);
  return remember(url, {
    dataUrl: `data:${sniff.mimeType};base64,${res.body.toString("base64")}`,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  });
}
