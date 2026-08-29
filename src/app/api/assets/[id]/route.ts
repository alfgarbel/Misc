import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteAsset, getOwnedAsset, renameAsset } from "@/lib/assets";
import { z } from "zod";
import { assetUsage } from "@/lib/templates";

export const runtime = "nodejs";

/** Serves the raw bytes so the editor canvas can show the real file. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const { id } = await params;
  const asset = await getOwnedAsset(getDb(), user.id, id);
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(Buffer.from(asset.data, "base64"), {
    headers: {
      "Content-Type": asset.mimeType,
      // Immutable rows, but private to one account — never a shared cache.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": "inline",
    },
  });
}

const patchSchema = z.object({ name: z.string().min(1).max(120) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a name" }, { status: 400 });
  }
  const renamed = await renameAsset(getDb(), user.id, id, parsed.data.name);
  if (!renamed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const { id } = await params;
  const db = getDb();

  // Deleting an asset a template still points at would silently break every
  // card that template renders, so name the templates instead. The editor
  // shows the same usage up front, from the same helper, so the two cannot
  // disagree about what is in use.
  const usage = await assetUsage(db, user.id);
  const usedBy = usage[id] ?? [];
  if (usedBy.length > 0) {
    return NextResponse.json(
      {
        error: `Still used by ${usedBy.map((t) => `"${t.name}"`).join(", ")}. Remove it from ${
          usedBy.length === 1 ? "that template" : "those templates"
        } first.`,
      },
      { status: 409 }
    );
  }

  const deleted = await deleteAsset(db, user.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
