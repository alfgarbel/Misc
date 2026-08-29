import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getOwnedScan, scanCsv, scanRows } from "@/lib/prospects";

export const runtime = "nodejs";

export async function GET(
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

  const csv = scanCsv(await scanRows(db, scan.id));
  const filename = `${scan.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() || "scan"}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
