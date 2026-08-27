import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";
import { inArray } from "drizzle-orm";
import type { Database } from "../db";
import { assets } from "../db/schema";
import {
  canvasOfSpec,
  fittedFontSize,
  resolvePlaceholders,
  specAssetIds,
  type Background,
  type Layer,
  type TemplateSpec,
} from "./spec";

interface LoadedAsset {
  id: string;
  kind: string;
  mimeType: string;
  data: Buffer;
  fontFamily: string | null;
  fontWeight: number | null;
  fontStyle: string | null;
}

/**
 * Asset rows are immutable — an edit uploads a new row and repoints the
 * spec — so caching them can never serve stale bytes. Without this, every
 * render would pull a few hundred KB of base64 back out of the database
 * and decode it again.
 *
 * The key is scoped by account, not just by asset id. Keying on the id
 * alone would let a cache entry warmed by its owner satisfy a lookup from
 * another account's spec, which is a cross-account read of the bytes
 * themselves — the ownership check on the query below never gets a say
 * once something is in the cache.
 */
const assetCache = new Map<string, LoadedAsset>();
const ASSET_CACHE_MAX = 64;

function cacheKey(userId: string, assetId: string): string {
  return `${userId}:${assetId}`;
}

function cachePut(userId: string, asset: LoadedAsset) {
  if (assetCache.size >= ASSET_CACHE_MAX) {
    // Oldest insertion first; plain FIFO is enough for a per-instance cache.
    const oldest = assetCache.keys().next().value;
    if (oldest) assetCache.delete(oldest);
  }
  assetCache.set(cacheKey(userId, asset.id), asset);
}

/**
 * Loads every asset a spec needs. Scoped to the owning account, so a spec
 * that names someone else's asset id renders without it rather than
 * leaking it.
 */
export async function loadSpecAssets(
  db: Database,
  spec: TemplateSpec,
  userId: string
): Promise<Map<string, LoadedAsset>> {
  const wanted = specAssetIds(spec);
  const found = new Map<string, LoadedAsset>();
  const missing: string[] = [];
  for (const id of wanted) {
    const hit = assetCache.get(cacheKey(userId, id));
    if (hit) found.set(id, hit);
    else missing.push(id);
  }
  if (missing.length > 0) {
    const rows = await db
      .select()
      .from(assets)
      .where(inArray(assets.id, missing));
    for (const row of rows) {
      if (row.userId !== userId) continue;
      const loaded: LoadedAsset = {
        id: row.id,
        kind: row.kind,
        mimeType: row.mimeType,
        data: Buffer.from(row.data, "base64"),
        fontFamily: row.fontFamily,
        fontWeight: row.fontWeight,
        fontStyle: row.fontStyle,
      };
      cachePut(userId, loaded);
      found.set(row.id, loaded);
    }
  }
  return found;
}

/** Only used by tests, so one case can't see another's cached assets. */
export function clearAssetCache() {
  assetCache.clear();
}

function dataUrl(a: LoadedAsset): string {
  return `data:${a.mimeType};base64,${a.data.toString("base64")}`;
}

let interPromise: Promise<{ regular: Buffer; bold: Buffer }> | null = null;

function loadInter() {
  if (!interPromise) {
    const dir = join(process.cwd(), "src", "fonts");
    interPromise = Promise.all([
      readFile(join(dir, "Inter-Regular.ttf")),
      readFile(join(dir, "Inter-Bold.ttf")),
    ]).then(([regular, bold]) => ({ regular, bold }));
  }
  return interPromise;
}

function backgroundStyle(bg: Background): React.CSSProperties {
  if (bg.type === "solid") return { backgroundColor: bg.color };
  if (bg.type === "gradient") {
    return {
      backgroundImage: `linear-gradient(${bg.angle}deg, ${bg.from} 0%, ${bg.to} 100%)`,
    };
  }
  // An image background is painted by the <img> layer below; this colour
  // sits behind it, and shows through on its own if the asset was deleted.
  return { backgroundColor: "#09090b" };
}

function LayerNode({
  layer,
  loaded,
  values,
}: {
  layer: Layer;
  loaded: Map<string, LoadedAsset>;
  values: URLSearchParams;
}) {
  const common: React.CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    opacity: layer.opacity,
    ...(layer.rotate ? { transform: `rotate(${layer.rotate}deg)` } : {}),
  };

  if (layer.type === "box") {
    return (
      <div
        style={{
          ...common,
          display: "flex",
          width: layer.w,
          height: layer.h,
          backgroundColor: layer.color,
          borderRadius: layer.radius,
        }}
      />
    );
  }

  if (layer.type === "image") {
    const asset = loaded.get(layer.assetId);
    if (!asset || asset.kind !== "image") return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dataUrl(asset)}
        width={layer.w}
        height={layer.h}
        alt=""
        style={{
          ...common,
          objectFit: layer.fit,
          borderRadius: layer.radius,
        }}
      />
    );
  }

  const text = resolvePlaceholders(layer.text, values);
  // An empty optional field should leave no gap, not an invisible box.
  if (text.trim() === "") return null;
  const font = layer.fontAssetId ? loaded.get(layer.fontAssetId) : null;
  const family = font?.fontFamily ?? layer.fontFamily ?? "Inter";
  const size = fittedFontSize(layer, text);
  return (
    <div
      style={{
        ...common,
        display: "flex",
        width: layer.w,
        fontFamily: `"${family}", Inter`,
        fontSize: size,
        fontWeight: layer.fontWeight,
        color: layer.color,
        lineHeight: layer.lineHeight,
        letterSpacing: layer.letterSpacing,
        textAlign: layer.align,
        justifyContent:
          layer.align === "center"
            ? "center"
            : layer.align === "right"
              ? "flex-end"
              : "flex-start",
      }}
    >
      {text}
    </div>
  );
}

function Watermark() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 28,
        display: "flex",
        alignItems: "center",
        padding: "8px 16px",
        borderRadius: 999,
        backgroundColor: "rgba(0,0,0,0.35)",
        color: "#e4e4e7",
        fontSize: 22,
        fontFamily: "Inter",
      }}
    >
      made with OGsmith
    </div>
  );
}

export interface RenderSpecOptions {
  watermark: boolean;
  /** Values for {{placeholders}} — normally the request's query string. */
  values: URLSearchParams;
  assets: Map<string, LoadedAsset>;
}

export async function renderSpecImage(
  spec: TemplateSpec,
  opts: RenderSpecOptions
): Promise<ImageResponse> {
  const inter = await loadInter();
  const loaded = opts.assets;

  // Every family a text layer names has to be registered up front; satori
  // silently falls back to the first font otherwise.
  const fonts: Array<{
    name: string;
    data: Buffer;
    weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    style: "normal" | "italic";
  }> = [
    { name: "Inter", data: inter.regular, weight: 400, style: "normal" },
    { name: "Inter", data: inter.bold, weight: 700, style: "normal" },
  ];
  const seenFamilies = new Set<string>();
  for (const asset of loaded.values()) {
    if (asset.kind !== "font" || !asset.fontFamily) continue;
    const key = `${asset.fontFamily}:${asset.fontWeight}:${asset.fontStyle}`;
    if (seenFamilies.has(key)) continue;
    seenFamilies.add(key);
    fonts.push({
      name: asset.fontFamily,
      data: asset.data,
      weight: (asset.fontWeight ?? 400) as 400,
      style: (asset.fontStyle === "italic" ? "italic" : "normal") as "normal",
    });
  }

  const canvas = canvasOfSpec(spec);
  const bgImage =
    spec.background.type === "image"
      ? loaded.get(spec.background.assetId)
      : null;

  const element = (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        overflow: "hidden",
        ...backgroundStyle(spec.background),
      }}
    >
      {bgImage && bgImage.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl(bgImage)}
          width={canvas.width}
          height={canvas.height}
          alt=""
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            objectFit:
              spec.background.type === "image" ? spec.background.fit : "cover",
          }}
        />
      ) : null}
      {spec.layers.map((layer) => (
        <LayerNode
          key={layer.id}
          layer={layer}
          loaded={loaded}
          values={opts.values}
        />
      ))}
      {opts.watermark ? <Watermark /> : null}
    </div>
  );

  return new ImageResponse(element, {
    width: canvas.width,
    height: canvas.height,
    fonts,
  });
}
