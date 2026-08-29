import { randomUUID } from "crypto";
import { and, eq, desc, sql } from "drizzle-orm";
import type { Database } from "./db";
import { assets } from "./db/schema";
import type { Asset } from "./db/schema";

/**
 * Uploads are capped well below anything that would slow a render: these
 * files are read on the request path and held in memory while satori runs.
 */
export const MAX_ASSET_BYTES = 512 * 1024;

export type AssetKind = "image" | "font";

/**
 * Formats verified against this project's own renderer, not assumed from
 * documentation. WOFF2 is deliberately absent: satori throws
 * "Unsupported OpenType signature wOF2" *after* the response has begun
 * streaming, so the caller gets a truncated image rather than an error.
 * Rejecting it here is the only place the user can be told anything useful.
 */
const IMAGE_SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
];

const FONT_SIGNATURES: Array<{ mime: string; bytes: number[] }> = [
  { mime: "font/ttf", bytes: [0x00, 0x01, 0x00, 0x00] }, // TrueType outlines
  { mime: "font/ttf", bytes: [0x74, 0x72, 0x75, 0x65] }, // "true"
  { mime: "font/otf", bytes: [0x4f, 0x54, 0x54, 0x4f] }, // "OTTO"
  { mime: "font/woff", bytes: [0x77, 0x4f, 0x46, 0x46] }, // "wOFF"
];

const WOFF2_SIGNATURE = [0x77, 0x4f, 0x46, 0x32]; // "wOF2"

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

export type SniffResult =
  | { ok: true; kind: AssetKind; mimeType: string }
  | { ok: false; reason: string };

/**
 * Identifies a file from its own bytes. The browser-supplied MIME type and
 * file extension are both trivially forged, and the renderer will act on
 * whatever we store, so neither is consulted.
 *
 * `maxBytes` defaults to the upload limit. Callers with a different budget
 * — a scraped og:image is allowed to be larger than something a user
 * stores — pass their own; the format checks are the same either way.
 */
export function sniffAsset(buf: Buffer, maxBytes = MAX_ASSET_BYTES): SniffResult {
  if (buf.length === 0) return { ok: false, reason: "File is empty." };
  if (buf.length > maxBytes) {
    return {
      ok: false,
      reason: `File is ${Math.round(buf.length / 1024)}KB. The limit is ${
        maxBytes / 1024
      }KB.`,
    };
  }
  for (const sig of IMAGE_SIGNATURES) {
    if (startsWith(buf, sig.bytes, sig.offset)) {
      return { ok: true, kind: "image", mimeType: sig.mime };
    }
  }
  for (const sig of FONT_SIGNATURES) {
    if (startsWith(buf, sig.bytes)) {
      return { ok: true, kind: "font", mimeType: sig.mime };
    }
  }
  if (startsWith(buf, WOFF2_SIGNATURE)) {
    return {
      ok: false,
      reason:
        "WOFF2 fonts can't be rendered. Upload the TTF, OTF, or WOFF version of the same font instead.",
    };
  }
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46])) {
    return {
      ok: false,
      reason: "WebP images aren't supported. Convert it to PNG or JPEG first.",
    };
  }
  if (startsWith(buf, [0x3c, 0x3f, 0x78, 0x6d]) || startsWith(buf, [0x3c, 0x73, 0x76, 0x67])) {
    return {
      ok: false,
      reason: "SVG images aren't supported. Export it as a PNG first.",
    };
  }
  return {
    ok: false,
    reason: "Unrecognised file. Images must be PNG, JPEG or GIF; fonts TTF, OTF or WOFF.",
  };
}

/** Turns a filename into something usable as a CSS font-family name. */
export function fontFamilyFromName(filename: string): string {
  const base = filename.replace(/\.[A-Za-z0-9]+$/, "");
  const cleaned = base
    .replace(/[_-]+/g, " ")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 64) || "Custom";
}

export interface CreateAssetInput {
  userId: string;
  filename: string;
  data: Buffer;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
}

export type CreateAssetResult =
  | { ok: true; asset: Asset }
  | { ok: false; reason: string };

export async function createAsset(
  db: Database,
  input: CreateAssetInput,
  limit: number
): Promise<CreateAssetResult> {
  const sniff = sniffAsset(input.data);
  if (!sniff.ok) return { ok: false, reason: sniff.reason };

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(assets)
    .where(eq(assets.userId, input.userId));
  if (count >= limit) {
    return {
      ok: false,
      reason: `You've reached your plan's limit of ${limit} uploaded files. Delete one, or upgrade for more.`,
    };
  }

  const isFont = sniff.kind === "font";
  const row = {
    id: randomUUID(),
    userId: input.userId,
    kind: sniff.kind,
    name: input.filename.slice(0, 120) || "untitled",
    mimeType: sniff.mimeType,
    byteSize: input.data.length,
    data: input.data.toString("base64"),
    fontFamily: isFont
      ? (input.fontFamily?.trim() || fontFamilyFromName(input.filename)).slice(0, 64)
      : null,
    fontWeight: isFont ? (input.fontWeight ?? 400) : null,
    fontStyle: isFont ? (input.fontStyle ?? "normal") : null,
    createdAt: new Date(),
  };
  await db.insert(assets).values(row);
  return { ok: true, asset: row };
}

/** Asset metadata without the payload — for listings, which never need it. */
export interface AssetSummary {
  id: string;
  kind: AssetKind;
  name: string;
  mimeType: string;
  byteSize: number;
  fontFamily: string | null;
  fontWeight: number | null;
  fontStyle: string | null;
  createdAt: Date;
}

export async function listAssets(
  db: Database,
  userId: string
): Promise<AssetSummary[]> {
  const rows = await db
    .select({
      id: assets.id,
      kind: assets.kind,
      name: assets.name,
      mimeType: assets.mimeType,
      byteSize: assets.byteSize,
      fontFamily: assets.fontFamily,
      fontWeight: assets.fontWeight,
      fontStyle: assets.fontStyle,
      createdAt: assets.createdAt,
    })
    .from(assets)
    .where(eq(assets.userId, userId))
    // createdAt has one-second granularity, so two uploads in the same
    // second tie and the order becomes whatever the database felt like —
    // observed returning oldest-first once and newest-first the next time,
    // for the same upload order. rowid breaks the tie by true insertion
    // order, so "newest first" actually holds.
    .orderBy(desc(assets.createdAt), desc(sql`rowid`));
  return rows as AssetSummary[];
}

/** Always scoped by user: an asset id alone must never grant access. */
export async function getOwnedAsset(
  db: Database,
  userId: string,
  assetId: string
): Promise<Asset | null> {
  const row = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), eq(assets.userId, userId)),
  });
  return row ?? null;
}

export async function deleteAsset(
  db: Database,
  userId: string,
  assetId: string
): Promise<boolean> {
  const existing = await getOwnedAsset(db, userId, assetId);
  if (!existing) return false;
  await db
    .delete(assets)
    .where(and(eq(assets.id, assetId), eq(assets.userId, userId)));
  return true;
}

/**
 * Renames an asset. Files arrive called things like IMG_0042.png or two
 * different logos both called logo.png, and until now that name was
 * permanent and was the only thing identifying them in a picker.
 */
export async function renameAsset(
  db: Database,
  userId: string,
  assetId: string,
  name: string
): Promise<boolean> {
  const trimmed = name.trim().slice(0, 120);
  if (!trimmed) return false;
  const existing = await getOwnedAsset(db, userId, assetId);
  if (!existing) return false;
  await db
    .update(assets)
    .set({ name: trimmed })
    .where(and(eq(assets.id, assetId), eq(assets.userId, userId)));
  return true;
}

export function assetDataUrl(asset: Pick<Asset, "mimeType" | "data">): string {
  return `data:${asset.mimeType};base64,${asset.data}`;
}
