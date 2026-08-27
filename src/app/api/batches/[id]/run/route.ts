import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { resolveApiKey } from "@/lib/keys";
import { getUserPlan } from "@/lib/usage";
import { getOwnedBatch, processSlice, SLICE_SIZE } from "@/lib/batches";
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

/** Renders the next slice. Call until `finished` is true. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await resolveCaller(req);
  if (!user) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const batch = await getOwnedBatch(db, user.id, id);
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plan = await getUserPlan(db, user.id);
  const slice = await processSlice(db, batch, user, plan, SLICE_SIZE);
  return NextResponse.json({ ok: true, ...slice });
}
