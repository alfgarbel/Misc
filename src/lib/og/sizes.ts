/**
 * Canvas sizes a card can be rendered at.
 *
 * Presets rather than free width and height: each one is a real platform's
 * expected shape, so a caller picks an intent instead of guessing pixels,
 * and the renderer never has to defend against a request for a canvas
 * large enough to exhaust memory.
 *
 * Every template is authored against the 1200-wide Open Graph card and
 * scaled from there, so `og` stays the reference and renders exactly as it
 * always has.
 */

export interface CardSize {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Where this shape is actually used, for the docs and the picker. */
  blurb: string;
  /**
   * The virtual width the design is laid out at before being scaled onto
   * this canvas. Narrower for tall shapes, which makes type and spacing
   * proportionally larger — a headline sized for a wide card is small when
   * it is only filling the middle of a full-screen story.
   */
  designWidth: number;
}

export const SIZES = {
  og: {
    id: "og",
    label: "Open Graph",
    width: 1200,
    height: 630,
    blurb: "Links on X, LinkedIn, Facebook, Slack and Discord. The default.",
    designWidth: 1200,
  },
  square: {
    id: "square",
    label: "Square",
    width: 1200,
    height: 1200,
    blurb: "Instagram and LinkedIn feed posts.",
    designWidth: 950,
  },
  story: {
    id: "story",
    label: "Story",
    width: 1080,
    height: 1920,
    blurb: "Instagram and Facebook stories, TikTok, Reels covers.",
    designWidth: 900,
  },
  youtube: {
    id: "youtube",
    label: "Video thumbnail",
    width: 1280,
    height: 720,
    blurb: "YouTube thumbnails and 16:9 video covers.",
    designWidth: 1200,
  },
  wide: {
    id: "wide",
    label: "Wide banner",
    width: 1600,
    height: 900,
    blurb: "Blog headers, email banners, presentation covers.",
    designWidth: 1200,
  },
} as const satisfies Record<string, CardSize>;

export type SizeId = keyof typeof SIZES;

export const SIZE_IDS = Object.keys(SIZES) as [SizeId, ...SizeId[]];

export const DEFAULT_SIZE: SizeId = "og";

/** The width the templates are authored against. */
export const DESIGN_WIDTH = SIZES.og.width;

export function sizeOf(id: SizeId | undefined): CardSize {
  return SIZES[id ?? DEFAULT_SIZE];
}

/**
 * How much to scale a design authored at DESIGN_WIDTH. Type and spacing
 * follow the canvas width so a card reads the same at thumbnail size
 * whatever shape it is.
 */
export function scaleFor(size: Pick<CardSize, "width" | "designWidth">): number {
  return size.width / size.designWidth;
}

/** The canvas the template actually lays out on, before scaling. */
export function designCanvasOf(
  size: Pick<CardSize, "width" | "height" | "designWidth">
): { width: number; height: number } {
  return {
    width: size.designWidth,
    height: Math.round(size.height / scaleFor(size)),
  };
}

/** Taller than wide: row layouts stack instead of sitting side by side. */
export function isPortrait(size: Pick<CardSize, "width" | "height">): boolean {
  return size.height > size.width;
}
