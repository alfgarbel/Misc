import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { resolveApiKey } from "@/lib/keys";
import { getUserPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { createBatch, listBatches, processSlice, SLICE_SIZE } from "@/lib/batches";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().max(80).optional(),
  storeImages: z.boolean().optional(),
  rows: z
    .array(
      z.object({
        key: z.string().max(200).optional(),
        params: z.record(z.string().max(40), z.string().max(2000)),
      })
    )
    .min(1),
});

/** Session for the dashboard, API key for scripts. Either identifies one account. */
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

export async function GET(req: NextRequest) {
  const user = await resolveCaller(req);
  if (!user) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const rows = await listBatches(getDb(), user.id);
  return NextResponse.json({
    batches: rows.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      total: b.total,
      done: b.done,
      failed: b.failed,
      storeImages: b.storeImages,
      retainUntil: b.retainUntil?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await resolveCaller(req);
  if (!user) return NextResponse.json({ error: "Not authorised" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.path.join(".") || "rows"}: ${issue.message}` },
      { status: 400 }
    );
  }

  const db = getDb();
  const plan = await getUserPlan(db, user.id);
  const limit = PLANS[plan].batchRows;
  if (parsed.data.rows.length > limit) {
    return NextResponse.json(
      {
        error: `A batch can hold ${limit} cards on the ${PLANS[plan].name} plan; you sent ${parsed.data.rows.length}.`,
      },
      { status: 402 }
    );
  }

  const batch = await createBatch(db, user.id, parsed.data);
  // Start immediately: most batches are small enough to finish here, and a
  // caller who submits one row should not have to poll to get it.
  const slice = await processSlice(db, batch, user, plan);

  return NextResponse.json({
    ok: true,
    batch: {
      id: batch.id,
      name: batch.name,
      total: slice.total,
      done: slice.done,
      failed: slice.failed,
      status: slice.status,
      finished: slice.finished,
    },
    // Told plainly, so a caller knows to keep going rather than assume a
    // queue is working through it in the background.
    nextStep: slice.finished
      ? null
      : `POST /api/batches/${batch.id}/run until finished is true (${SLICE_SIZE} cards per call)`,
  });
}
