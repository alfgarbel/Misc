import type { ImageResponse } from "next/og";
import type { Database } from "../db";
import { parseOgParams } from "../og/params";
import { renderOgImage } from "../og/render";
import { applyUrlMetadata, getUrlMetadata, type PageMetadata } from "./index";
import { loadHeroImage } from "./image";

/**
 * The steps shared by the public render endpoint and the dashboard's
 * preview. They live together so the preview cannot drift from what a
 * social crawler will actually be served — a preview that quietly differs
 * from production is worse than no preview at all.
 */

export type CardFailure = { ok: false; status: number; message: string; details?: string[] };

export type ResolveResult =
  | { ok: true; params: URLSearchParams; meta: PageMetadata | null }
  | CardFailure;

/**
 * Folds a source page's metadata into the request parameters.
 *
 * A failed scrape is only fatal when the caller supplied nothing of their
 * own: explicit parameters can carry the card by themselves, so a site
 * being briefly unreachable shouldn't blank someone's post.
 */
export async function resolveUrlParams(
  db: Database,
  params: URLSearchParams,
  sourceUrl: string
): Promise<ResolveResult> {
  const result = await getUrlMetadata(db, sourceUrl);
  if (!result.ok) {
    if (!params.get("title")) {
      return { ok: false, status: 422, message: result.message };
    }
    return { ok: true, params, meta: null };
  }
  return {
    ok: true,
    params: applyUrlMetadata(params, result.meta),
    meta: result.meta,
  };
}

export type RenderResult = { ok: true; image: ImageResponse } | CardFailure;

/**
 * Renders resolved parameters to a PNG, fetching the source page's own
 * artwork only when the template that draws it was actually chosen.
 */
export async function renderResolvedCard(
  params: URLSearchParams,
  opts: { watermark: boolean; logo?: string | null; pageMeta?: PageMetadata | null }
): Promise<RenderResult> {
  const parsed = parseOgParams(params);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: "Invalid parameters",
      details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  const hero =
    parsed.data.template === "link" && opts.pageMeta
      ? await loadHeroImage(opts.pageMeta.imageUrl)
      : null;

  try {
    const image = await renderOgImage(parsed.data, {
      watermark: opts.watermark,
      logo: opts.logo ?? null,
      hero,
    });
    return { ok: true, image };
  } catch (err) {
    console.error("OG render failed:", err);
    return { ok: false, status: 500, message: "Image rendering failed" };
  }
}
