import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { createAsset, listAssets, MAX_ASSET_BYTES } from "@/lib/assets";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const db = getDb();
  const [assets, plan] = await Promise.all([
    listAssets(db, user.id),
    getUserPlan(db, user.id),
  ]);
  return NextResponse.json({ assets, limit: PLANS[plan].assets });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Upload must be multipart/form-data" },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file supplied" }, { status: 400 });
  }
  // Checked before reading the body into memory as well as after sniffing,
  // so an oversized upload is rejected without being buffered in full.
  if (file.size > MAX_ASSET_BYTES) {
    return NextResponse.json(
      {
        error: `File is ${Math.round(file.size / 1024)}KB. The limit is ${
          MAX_ASSET_BYTES / 1024
        }KB.`,
      },
      { status: 413 }
    );
  }

  const weightRaw = Number(form.get("fontWeight"));
  const styleRaw = String(form.get("fontStyle") ?? "normal");
  const db = getDb();
  const plan = await getUserPlan(db, user.id);
  const result = await createAsset(
    db,
    {
      userId: user.id,
      filename: file.name,
      data: Buffer.from(await file.arrayBuffer()),
      fontFamily: String(form.get("fontFamily") ?? "") || undefined,
      fontWeight:
        Number.isFinite(weightRaw) && weightRaw >= 100 && weightRaw <= 900
          ? Math.round(weightRaw)
          : undefined,
      fontStyle: styleRaw === "italic" ? "italic" : "normal",
    },
    PLANS[plan].assets
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  // The base64 payload never goes back to the client; it just uploaded it.
  const summary = { ...result.asset, data: undefined };
  return NextResponse.json({ ok: true, asset: summary });
}
