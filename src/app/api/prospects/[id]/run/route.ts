import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getOwnedScan, processScanSlice } from "@/lib/prospects";

export const runtime = "nodejs";
// Reading five sites is five network round trips; the default is too tight.
export const maxDuration = 60;

/** Reads the next slice. Call until `finished` is true. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { id } = await params;
  const db = getDb();
  const scan = await getOwnedScan(db, user.id, id);
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slice = await processScanSlice(db, scan);
  return NextResponse.json({ ok: true, ...slice });
}
