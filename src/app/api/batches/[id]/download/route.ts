import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { resolveApiKey } from "@/lib/keys";
import { getOwnedBatch, zipOfBatch, safeEntryName } from "@/lib/batches";
import { users } from "@/lib/db/schema";

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

  const result = await zipOfBatch(db, batch);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }
  // The name is derived from user input, so it is sanitised before going
  // into a header that a browser turns into a filename on disk.
  const filename = safeEntryName(batch.name, "batch") + ".zip";
  return new NextResponse(new Uint8Array(result.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
