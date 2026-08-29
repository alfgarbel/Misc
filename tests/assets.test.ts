import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./helpers";
import { provisionAccount } from "@/lib/accounts";
import {
  createAsset,
  deleteAsset,
  renameAsset,
  fontFamilyFromName,
  getOwnedAsset,
  listAssets,
  sniffAsset,
  MAX_ASSET_BYTES,
} from "@/lib/assets";
import { loadSpecAssets, clearAssetCache } from "@/lib/og/render-spec";
import { templateSpecSchema } from "@/lib/og/spec";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const GIF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const TTF = Buffer.from([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]);
const OTF = Buffer.from([0x4f, 0x54, 0x54, 0x4f, 0, 0, 0, 0]);
const WOFF = Buffer.from([0x77, 0x4f, 0x46, 0x46, 0, 0, 0, 0]);
const WOFF2 = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const SVG = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>");

describe("sniffAsset", () => {
  it("identifies the formats the renderer can actually draw", () => {
    expect(sniffAsset(PNG)).toEqual({ ok: true, kind: "image", mimeType: "image/png" });
    expect(sniffAsset(JPEG)).toEqual({ ok: true, kind: "image", mimeType: "image/jpeg" });
    expect(sniffAsset(GIF)).toEqual({ ok: true, kind: "image", mimeType: "image/gif" });
    expect(sniffAsset(TTF)).toEqual({ ok: true, kind: "font", mimeType: "font/ttf" });
    expect(sniffAsset(OTF)).toEqual({ ok: true, kind: "font", mimeType: "font/otf" });
    expect(sniffAsset(WOFF)).toEqual({ ok: true, kind: "font", mimeType: "font/woff" });
  });

  it("rejects WOFF2, which fails mid-stream inside the renderer", () => {
    const r = sniffAsset(WOFF2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/WOFF2/);
  });

  it("explains the other formats people will reach for", () => {
    const webp = sniffAsset(WEBP);
    const svg = sniffAsset(SVG);
    expect(webp.ok).toBe(false);
    expect(svg.ok).toBe(false);
    if (!webp.ok) expect(webp.reason).toMatch(/WebP/);
    if (!svg.ok) expect(svg.reason).toMatch(/SVG/);
  });

  it("trusts the bytes, not the name — a PNG called .ttf is an image", () => {
    // The declared type is attacker-controlled; feeding a PNG to the font
    // parser is what crashes the renderer.
    expect(sniffAsset(PNG)).toMatchObject({ kind: "image" });
  });

  it("rejects empty and oversized files", () => {
    expect(sniffAsset(Buffer.alloc(0)).ok).toBe(false);
    const huge = Buffer.concat([PNG, Buffer.alloc(MAX_ASSET_BYTES)]);
    expect(sniffAsset(huge).ok).toBe(false);
  });
});

describe("fontFamilyFromName", () => {
  it("turns a filename into a usable family name", () => {
    expect(fontFamilyFromName("Inter-Bold.ttf")).toBe("Inter Bold");
    expect(fontFamilyFromName("my_custom_font.otf")).toBe("my custom font");
    expect(fontFamilyFromName("....ttf")).toBe("Custom");
  });
});

async function seed() {
  const db = await createTestDb();
  const owner = await provisionAccount(db, { email: "owner@example.com", passwordHash: "h" });
  const other = await provisionAccount(db, { email: "other@example.com", passwordHash: "h" });
  return { db, ownerId: owner.userId, otherId: other.userId };
}

describe("asset storage", () => {
  it("stores an image and lists it without the payload", async () => {
    const { db, ownerId } = await seed();
    const created = await createAsset(db, { userId: ownerId, filename: "logo.png", data: PNG }, 10);
    expect(created.ok).toBe(true);

    const list = await listAssets(db, ownerId);
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("image");
    expect(list[0]).not.toHaveProperty("data");
  });

  it("records font metadata, defaulting the family from the filename", async () => {
    const { db, ownerId } = await seed();
    await createAsset(db, { userId: ownerId, filename: "Space-Grotesk.ttf", data: TTF }, 10);
    const [asset] = await listAssets(db, ownerId);
    expect(asset.fontFamily).toBe("Space Grotesk");
    expect(asset.fontWeight).toBe(400);
    expect(asset.fontStyle).toBe("normal");
  });

  it("enforces the plan's file limit", async () => {
    const { db, ownerId } = await seed();
    await createAsset(db, { userId: ownerId, filename: "a.png", data: PNG }, 2);
    await createAsset(db, { userId: ownerId, filename: "b.png", data: PNG }, 2);
    const third = await createAsset(db, { userId: ownerId, filename: "c.png", data: PNG }, 2);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.reason).toMatch(/limit of 2/);
  });

  it("orders newest first, deterministically, when timestamps tie", async () => {
    // createdAt has one-second granularity, so two uploads in the same
    // second tie. Without a tiebreaker the order was whatever the database
    // felt like — observed returning oldest-first once and newest-first the
    // next time for the same upload order, which is what made a picker of
    // filenames impossible to reason about.
    const { db, ownerId } = await seed();
    for (const name of ["first.png", "second.png", "third.png"]) {
      const created = await createAsset(db, { userId: ownerId, filename: name, data: PNG }, 10);
      expect(created.ok, name).toBe(true);
    }
    const first = (await listAssets(db, ownerId)).map((a) => a.name);
    expect(first).toEqual(["third.png", "second.png", "first.png"]);

    // Same answer every time, not just once.
    for (let i = 0; i < 5; i++) {
      expect((await listAssets(db, ownerId)).map((a) => a.name)).toEqual(first);
    }
  });

  it("renames an asset, so duplicate filenames stop being permanent", async () => {
    const { db, ownerId } = await seed();
    const created = await createAsset(db, { userId: ownerId, filename: "logo.png", data: PNG }, 10);
    if (!created.ok) throw new Error("setup failed");

    expect(await renameAsset(db, ownerId, created.asset.id, "  Blue badge  ")).toBe(true);
    const [asset] = await listAssets(db, ownerId);
    expect(asset.name).toBe("Blue badge");
  });

  it("refuses a blank rename rather than leaving something unnameable", async () => {
    const { db, ownerId } = await seed();
    const created = await createAsset(db, { userId: ownerId, filename: "logo.png", data: PNG }, 10);
    if (!created.ok) throw new Error("setup failed");
    expect(await renameAsset(db, ownerId, created.asset.id, "   ")).toBe(false);
    expect((await listAssets(db, ownerId))[0].name).toBe("logo.png");
  });

  it("will not rename another account's asset", async () => {
    const { db, ownerId, otherId } = await seed();
    const created = await createAsset(db, { userId: ownerId, filename: "logo.png", data: PNG }, 10);
    if (!created.ok) throw new Error("setup failed");
    expect(await renameAsset(db, otherId, created.asset.id, "stolen")).toBe(false);
    expect((await listAssets(db, ownerId))[0].name).toBe("logo.png");
  });

  it("will not read or delete another account's asset", async () => {
    const { db, ownerId, otherId } = await seed();
    const created = await createAsset(db, { userId: ownerId, filename: "a.png", data: PNG }, 10);
    if (!created.ok) throw new Error("setup failed");

    expect(await getOwnedAsset(db, otherId, created.asset.id)).toBeNull();
    expect(await deleteAsset(db, otherId, created.asset.id)).toBe(false);
    expect(await getOwnedAsset(db, ownerId, created.asset.id)).not.toBeNull();
  });
});

describe("loadSpecAssets", () => {
  beforeEach(() => clearAssetCache());

  const specWith = (assetId: string) =>
    templateSpecSchema.parse({
      version: 1,
      background: { type: "solid", color: "#000000" },
      layers: [
        { id: "i", type: "image", x: 0, y: 0, w: 100, h: 100, assetId },
      ],
    });

  it("loads assets the account owns", async () => {
    const { db, ownerId } = await seed();
    const created = await createAsset(db, { userId: ownerId, filename: "a.png", data: PNG }, 10);
    if (!created.ok) throw new Error("setup failed");

    const loaded = await loadSpecAssets(db, specWith(created.asset.id), ownerId);
    expect(loaded.get(created.asset.id)?.kind).toBe("image");
  });

  it("does not serve one account's asset to another, even once cached", async () => {
    // Regression: the cache was keyed on asset id alone, so an entry warmed
    // by the owner satisfied a lookup from another account's spec and
    // leaked the bytes into their card. Order matters — the owner must
    // render first for the cache to be warm.
    const { db, ownerId, otherId } = await seed();
    const created = await createAsset(db, { userId: ownerId, filename: "a.png", data: PNG }, 10);
    if (!created.ok) throw new Error("setup failed");
    const spec = specWith(created.asset.id);

    const owner = await loadSpecAssets(db, spec, ownerId);
    expect(owner.has(created.asset.id)).toBe(true);

    const attacker = await loadSpecAssets(db, spec, otherId);
    expect(attacker.has(created.asset.id)).toBe(false);
  });

  it("skips assets that no longer exist rather than failing the render", async () => {
    const { db, ownerId } = await seed();
    const loaded = await loadSpecAssets(db, specWith("does-not-exist"), ownerId);
    expect(loaded.size).toBe(0);
  });
});
