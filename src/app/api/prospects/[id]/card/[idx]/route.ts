import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getOwnedScan, scanRows } from "@/lib/prospects";
import { parseOgParams } from "@/lib/og/params";
import { renderOgImage } from "@/lib/og/render";

export const runtime = "nodejs";

/**
 * The card this prospect could have, rendered on demand.
 *
 * Scans store the page's title and description rather than a PNG per row.
 * A card is a few milliseconds to draw and would be megabytes to keep, and
 * rendering from the stored text means the picture always matches the
 * finding that was recorded.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; idx: string }> }
) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { id, idx } = await params;
  const db = getDb();
  const scan = await getOwnedScan(db, user.id, id);
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = (await scanRows(db, scan.id)).find((r) => r.idx === Number(idx));
  if (!row || !row.domain) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = parseOgParams(
    new URLSearchParams({
      template: "gradient",
      title: row.title ?? row.domain,
      subtitle: row.description ?? "",
      site: row.siteName ?? row.domain,
    })
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Unrenderable" }, { status: 422 });
  }
  return renderOgImage(parsed.data, { watermark: false });
}
