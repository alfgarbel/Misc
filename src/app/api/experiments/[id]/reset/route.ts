import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOwnedExperiment, resetResults } from "@/lib/experiments";

export const runtime = "nodejs";

/**
 * Clears the counters after a design change, keeping every page on the
 * variant it already has so nothing already shared changes appearance.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const { id } = await params;
  const db = getDb();
  const row = await getOwnedExperiment(db, user.id, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const kept = await resetResults(db, row.id);
  return NextResponse.json({ ok: true, assignmentsKept: kept });
}
