import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import {
  deleteScan,
  emailForRow,
  getOwnedScan,
  scanRows,
} from "@/lib/prospects";

export const runtime = "nodejs";

async function admin() {
  const user = await getCurrentUser().catch(() => null);
  return user && isAdminUser(user) ? user : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  const db = getDb();
  const scan = await getOwnedScan(db, user.id, id);
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const signature = url.searchParams.get("signature") ?? "— [your name]";
  const base = `${url.protocol}//${url.host}`;
  const rows = await scanRows(db, scan.id);

  return NextResponse.json({
    scan,
    rows: rows.map((r) => ({
      ...r,
      email: emailForRow(r, { signature, checkerBase: base }),
    })),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  const removed = await deleteScan(getDb(), user.id, id);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
