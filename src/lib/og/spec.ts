import { z } from "zod";
import { SIZE_IDS, DEFAULT_SIZE, sizeOf } from "./sizes";

/**
 * A card design produced by the visual editor.
 *
 * Layers are absolutely positioned on a fixed 1200x630 canvas, because that
 * is what a drag-and-drop editor actually manipulates: dragging sets x/y,
 * resizing sets w/h. Flow layout would make the canvas and the render
 * disagree the moment text length changed.
 *
 * Images and fonts are referenced by asset id only — never by URL. The
 * renderer runs server-side, so accepting arbitrary URLs here would turn
 * every template into a server-side request forgery primitive.
 */

/** The default canvas. A spec records its own size; these are the fallback. */
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 630;

export const MAX_LAYERS = 24;
export const MAX_TEXT_LENGTH = 500;
/** Bound on a single resolved placeholder value, before layer text limits. */
export const MAX_PLACEHOLDER_LENGTH = 300;

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color");

/** rgba() is allowed for fills so the editor can express transparency. */
const cssColor = z.union([
  hexColor,
  z
    .string()
    .regex(
      /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/,
      "must be a hex or rgb(a) color"
    ),
]);

const assetId = z.string().min(1).max(64);
/**
 * An image layer may exist before its image has been chosen — that is a
 * normal intermediate state in an editor, and refusing to save it would
 * mean losing the layer's position and size. The renderer draws nothing
 * for an unset or unknown asset.
 */
const optionalAssetId = z.string().max(64);

/** Coordinates may sit slightly off-canvas so layers can bleed off an edge. */
const coord = z.number().min(-2000).max(4000);
const size = z.number().min(1).max(4000);

const baseLayer = {
  id: z.string().min(1).max(64),
  x: coord,
  y: coord,
  opacity: z.number().min(0).max(1).default(1),
  rotate: z.number().min(-180).max(180).default(0),
};

export const textLayerSchema = z.object({
  ...baseLayer,
  type: z.literal("text"),
  text: z.string().max(MAX_TEXT_LENGTH),
  w: size,
  fontFamily: z.string().max(64).default("Inter"),
  /** Set when fontFamily comes from an uploaded font rather than Inter. */
  fontAssetId: assetId.nullable().default(null),
  fontSize: z.number().min(8).max(300),
  fontWeight: z.number().int().min(100).max(900).default(400),
  color: cssColor,
  align: z.enum(["left", "center", "right"]).default("left"),
  lineHeight: z.number().min(0.6).max(3).default(1.2),
  letterSpacing: z.number().min(-20).max(40).default(0),
  /** Shrinks the type when the resolved text is longer than the design. */
  autoFit: z.boolean().default(true),
});

export const imageLayerSchema = z.object({
  ...baseLayer,
  type: z.literal("image"),
  assetId: optionalAssetId,
  w: size,
  h: size,
  fit: z.enum(["cover", "contain", "fill"]).default("contain"),
  radius: z.number().min(0).max(2000).default(0),
});

export const boxLayerSchema = z.object({
  ...baseLayer,
  type: z.literal("box"),
  w: size,
  h: size,
  color: cssColor,
  radius: z.number().min(0).max(2000).default(0),
});

export const layerSchema = z.discriminatedUnion("type", [
  textLayerSchema,
  imageLayerSchema,
  boxLayerSchema,
]);

export const backgroundSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color: cssColor }),
  z.object({
    type: z.literal("gradient"),
    from: cssColor,
    to: cssColor,
    angle: z.number().min(0).max(360).default(135),
  }),
  z.object({
    type: z.literal("image"),
    assetId: optionalAssetId,
    fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  }),
]);

export const templateSpecSchema = z.object({
  version: z.literal(1).default(1),
  /**
   * Which canvas this design was laid out on. Layers carry absolute
   * coordinates, so the size belongs to the design — a request cannot ask
   * for a different one without moving every layer.
   */
  size: z.enum(SIZE_IDS).default(DEFAULT_SIZE),
  background: backgroundSchema,
  layers: z.array(layerSchema).max(MAX_LAYERS),
});

export type TextLayer = z.infer<typeof textLayerSchema>;
export type ImageLayer = z.infer<typeof imageLayerSchema>;
export type BoxLayer = z.infer<typeof boxLayerSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type Background = z.infer<typeof backgroundSchema>;
export type TemplateSpec = z.infer<typeof templateSpecSchema>;

/** Parses a spec from stored JSON. Rows can outlive the code that wrote them. */
export function parseSpec(json: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { success: false as const, error: "Template spec is not valid JSON" };
  }
  const parsed = templateSpecSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false as const,
      error: `Template spec is invalid: ${issue.path.join(".")} ${issue.message}`,
    };
  }
  return { success: true as const, data: parsed.data };
}

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]{1,32})\s*\}\}/g;

/**
 * Substitutes {{name}} with the matching query parameter. Values land in
 * satori as text nodes, never as markup, so the only risk is length — an
 * unbounded value would push the render past its size limits.
 *
 * An unknown placeholder resolves to an empty string rather than showing
 * its own braces, so a card with a missing optional field looks blank
 * instead of broken.
 */
export function resolvePlaceholders(
  text: string,
  values: URLSearchParams | Record<string, string>
): string {
  const get = (k: string): string | null =>
    values instanceof URLSearchParams ? values.get(k) : (values[k] ?? null);
  return text.replace(PLACEHOLDER, (_m, name: string) =>
    (get(name) ?? "").slice(0, MAX_PLACEHOLDER_LENGTH)
  );
}

/** Every placeholder a spec refers to, in first-seen order. */
export function specPlaceholders(spec: TemplateSpec): string[] {
  const seen: string[] = [];
  for (const layer of spec.layers) {
    if (layer.type !== "text") continue;
    for (const m of layer.text.matchAll(PLACEHOLDER)) {
      if (!seen.includes(m[1])) seen.push(m[1]);
    }
  }
  return seen;
}

/** Every asset a spec depends on — used to block deleting one still in use. */
export function specAssetIds(spec: TemplateSpec): string[] {
  const ids = new Set<string>();
  if (spec.background.type === "image" && spec.background.assetId) {
    ids.add(spec.background.assetId);
  }
  for (const layer of spec.layers) {
    if (layer.type === "image" && layer.assetId) ids.add(layer.assetId);
    if (layer.type === "text" && layer.fontAssetId) ids.add(layer.fontAssetId);
  }
  return [...ids];
}

/**
 * Shrinks type that would overflow its box. satori has no text-overflow, so
 * a title longer than the design anticipated would otherwise run off the
 * card. Approximates width from the average glyph advance of the sizes we
 * ship; erring small keeps text inside the box.
 */
export function fittedFontSize(
  layer: Pick<TextLayer, "fontSize" | "w" | "lineHeight" | "autoFit">,
  text: string,
  maxLines = 3
): number {
  if (!layer.autoFit || text.length === 0) return layer.fontSize;
  const avgGlyphRatio = 0.52;
  const perLine = Math.max(
    1,
    Math.floor(layer.w / (layer.fontSize * avgGlyphRatio))
  );
  const lines = Math.ceil(text.length / perLine);
  if (lines <= maxLines) return layer.fontSize;
  const scale = Math.sqrt(maxLines / lines);
  return Math.max(12, Math.round(layer.fontSize * scale));
}

/** The pixel canvas a spec is drawn on. */
export function canvasOfSpec(spec: Pick<TemplateSpec, "size">): {
  width: number;
  height: number;
} {
  const size = sizeOf(spec.size);
  return { width: size.width, height: size.height };
}

/** A blank card, used when creating a template from scratch. */
export function starterSpec(): TemplateSpec {
  return templateSpecSchema.parse({
    version: 1,
    background: { type: "gradient", from: "#0f172a", to: "#4338ca", angle: 135 },
    layers: [
      {
        id: "title",
        type: "text",
        text: "{{title}}",
        x: 80,
        y: 300,
        w: 1040,
        fontSize: 76,
        fontWeight: 700,
        color: "#ffffff",
        lineHeight: 1.1,
      },
      {
        id: "subtitle",
        type: "text",
        text: "{{subtitle}}",
        x: 80,
        y: 430,
        w: 1040,
        fontSize: 34,
        fontWeight: 400,
        color: "rgba(255,255,255,0.75)",
        lineHeight: 1.35,
      },
    ],
  });
}
