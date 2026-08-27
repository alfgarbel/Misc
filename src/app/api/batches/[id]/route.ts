import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { resolveApiKey } from "@/lib/keys";
import { deleteBatch, getOwnedBatch, listRows } from "@/lib/batches";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

async function resolveCaller(req: NextRequest) {
  const session = await getCurrentUser();
  if (session) return session;
  const key =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("key");
  if (!key) return null;
  const resolved = await resolveApiKey(getDb(), key);
  if (!resolved) return null;
  return (
    (await getDb().query.users.findFirst({ where: eq(users.id, resolved.userId) })) ??
    null
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await resolveCaller(req);
  if (!user) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const batch = await getOwnedBatch(db, user.id, id);
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await listRows(db, batch.id);
  return NextResponse.json({
    id: batch.id,
    name: batch.name,
    status: batch.status,
    total: batch.total,
    done: batch.done,
    failed: batch.failed,
    storeImages: batch.storeImages,
    retainUntil: batch.retainUntil?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
    completedAt: batch.completedAt?.toISOString() ?? null,
    rows: rows.map((r) => ({
      idx: r.idx,
      key: r.key,
      status: r.status,
      error: r.error,
      filename: r.filename,
      byteSize: r.byteSize,
    })),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await resolveCaller(req);
  if (!user) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteBatch(getDb(), user.id, id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
