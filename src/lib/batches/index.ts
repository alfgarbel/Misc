import { randomUUID } from "crypto";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import type { Database } from "../db";
import { batches, batchRows } from "../db/schema";
import type { BatchRow, BatchItemRow, User } from "../db/schema";
import { applyBrandDefaults } from "../og/params";
import { renderResolvedCard, resolveUrlParams } from "../urlcard/card";
import { checkAndRecordRender } from "../usage";
import { PLANS, type PlanId } from "../plans";
import { dispatchEvent } from "../webhooks";
import { buildZip, safeEntryName } from "./zip";

export * from "./zip";

/** How long rendered bytes are kept. A batch is a handoff, not a file host. */
export const RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Rows rendered per processing call.
 *
 * There is no queue in this architecture, so a batch is worked through a
 * slice at a time inside ordinary requests rather than pretending to be
 * asynchronous. Small enough to finish well inside a function timeout;
 * most batches never need a second call.
 */
export const SLICE_SIZE = 10;

export interface BatchInput {
  name?: string;
  storeImages?: boolean;
  rows: Array<{ key?: string; params: Record<string, string> }>;
}

export async function createBatch(
  db: Database,
  userId: string,
  input: BatchInput,
  now: Date = new Date()
): Promise<BatchRow> {
  const batch: BatchRow = {
    id: randomUUID(),
    userId,
    name: (input.name ?? "Batch").slice(0, 80) || "Batch",
    status: "pending",
    total: input.rows.length,
    done: 0,
    failed: 0,
    storeImages: input.storeImages !== false,
    retainUntil: new Date(now.getTime() + RETENTION_MS),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  await db.insert(batches).values(batch);
  if (input.rows.length > 0) {
    await db.insert(batchRows).values(
      input.rows.map((row, idx) => ({
        batchId: batch.id,
        idx,
        key: row.key?.slice(0, 200) ?? null,
        params: JSON.stringify(row.params),
        status: "pending",
        error: null,
        filename: null,
        data: null,
        byteSize: null,
        renderedAt: null,
      }))
    );
  }
  return batch;
}

export async function getOwnedBatch(
  db: Database,
  userId: string,
  id: string
): Promise<BatchRow | null> {
  const row = await db.query.batches.findFirst({
    where: and(eq(batches.id, id), eq(batches.userId, userId)),
  });
  return row ?? null;
}

export async function listBatches(
  db: Database,
  userId: string,
  limit = 20
): Promise<BatchRow[]> {
  return db
    .select()
    .from(batches)
    .where(eq(batches.userId, userId))
    .orderBy(desc(batches.createdAt))
    .limit(limit);
}

/** Row summaries without the payload, which listings never need. */
export async function listRows(db: Database, batchId: string) {
  return db
    .select({
      idx: batchRows.idx,
      key: batchRows.key,
      params: batchRows.params,
      status: batchRows.status,
      error: batchRows.error,
      filename: batchRows.filename,
      byteSize: batchRows.byteSize,
    })
    .from(batchRows)
    .where(eq(batchRows.batchId, batchId))
    .orderBy(asc(batchRows.idx));
}

function filenameFor(row: Pick<BatchItemRow, "key" | "idx">): string {
  const base = row.key ? safeEntryName(row.key, `card-${row.idx + 1}`) : `card-${row.idx + 1}`;
  return base.toLowerCase().endsWith(".png") ? base : `${base}.png`;
}

export interface SliceResult {
  processed: number;
  done: number;
  failed: number;
  total: number;
  status: string;
  /** True when nothing is left to render. */
  finished: boolean;
}

/**
 * Renders the next few pending rows.
 *
 * A row that fails is recorded and the batch carries on: one bad set of
 * parameters in five hundred should not cost the other four hundred and
 * ninety-nine. Rows go through the same render path as the API and count
 * against quota, because they are real renders.
 */
export async function processSlice(
  db: Database,
  batch: BatchRow,
  user: User,
  plan: PlanId,
  limit = SLICE_SIZE,
  now: Date = new Date()
): Promise<SliceResult> {
  const pending = await db
    .select()
    .from(batchRows)
    .where(and(eq(batchRows.batchId, batch.id), eq(batchRows.status, "pending")))
    .orderBy(asc(batchRows.idx))
    .limit(limit);

  if (pending.length > 0 && batch.status === "pending") {
    await db
      .update(batches)
      .set({ status: "running", updatedAt: now })
      .where(eq(batches.id, batch.id));
  }

  let processed = 0;
  for (const row of pending) {
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(JSON.parse(row.params) as Record<string, string>);
    } catch {
      await markRow(db, batch.id, row.idx, { error: "Row parameters are not valid" }, now);
      processed += 1;
      continue;
    }

    const quota = await checkAndRecordRender(db, user.id);
    if (!quota.allowed) {
      await markRow(
        db,
        batch.id,
        row.idx,
        { error: "Monthly render quota exceeded" },
        now
      );
      processed += 1;
      continue;
    }

    const sourceUrl = params.get("url");
    let pageMeta = null;
    if (sourceUrl) {
      const resolved = await resolveUrlParams(db, params, sourceUrl);
      if (!resolved.ok) {
        await markRow(db, batch.id, row.idx, { error: resolved.message }, now);
        processed += 1;
        continue;
      }
      params = resolved.params;
      pageMeta = resolved.meta;
    }

    params = applyBrandDefaults(params, {
      template: user.brandTemplate,
      theme: user.brandTheme,
      accent: user.brandAccent,
      site: user.brandSite,
    });

    const watermark = PLANS[plan].watermark;
    const rendered = await renderResolvedCard(params, {
      watermark,
      logo: watermark ? null : user.brandLogo,
      pageMeta,
    });
    if (!rendered.ok) {
      await markRow(
        db,
        batch.id,
        row.idx,
        { error: rendered.details?.[0] ?? rendered.message },
        now
      );
      processed += 1;
      continue;
    }

    const bytes = Buffer.from(await rendered.image.arrayBuffer());
    await markRow(
      db,
      batch.id,
      row.idx,
      {
        filename: filenameFor(row),
        data: batch.storeImages ? bytes.toString("base64") : null,
        byteSize: bytes.length,
      },
      now
    );
    processed += 1;
  }

  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${batchRows.status} = 'ok' then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${batchRows.status} = 'error' then 1 else 0 end)`,
      remaining: sql<number>`sum(case when ${batchRows.status} = 'pending' then 1 else 0 end)`,
    })
    .from(batchRows)
    .where(eq(batchRows.batchId, batch.id));

  const finished = (counts.remaining ?? 0) === 0;
  const status = finished ? "completed" : "running";
  await db
    .update(batches)
    .set({
      status,
      done: counts.done ?? 0,
      failed: counts.failed ?? 0,
      updatedAt: now,
      ...(finished && !batch.completedAt ? { completedAt: now } : {}),
    })
    .where(eq(batches.id, batch.id));

  if (finished && batch.status !== "completed") {
    await dispatchEvent(
      db,
      user.id,
      "batch.completed",
      {
        batchId: batch.id,
        name: batch.name,
        total: counts.total ?? 0,
        done: counts.done ?? 0,
        failed: counts.failed ?? 0,
      },
      now
    );
  }

  return {
    processed,
    done: counts.done ?? 0,
    failed: counts.failed ?? 0,
    total: counts.total ?? 0,
    status,
    finished,
  };
}

async function markRow(
  db: Database,
  batchId: string,
  idx: number,
  patch: { error?: string; filename?: string; data?: string | null; byteSize?: number },
  now: Date
) {
  await db
    .update(batchRows)
    .set({
      status: patch.error ? "error" : "ok",
      error: patch.error ?? null,
      filename: patch.filename ?? null,
      data: patch.data ?? null,
      byteSize: patch.byteSize ?? null,
      renderedAt: now,
    })
    .where(and(eq(batchRows.batchId, batchId), eq(batchRows.idx, idx)));
}

export type ZipResult =
  | { ok: true; zip: Buffer; entries: number }
  | { ok: false; reason: string };

export async function zipOfBatch(
  db: Database,
  batch: BatchRow,
  now: Date = new Date()
): Promise<ZipResult> {
  if (!batch.storeImages) {
    return { ok: false, reason: "This batch was run without keeping images." };
  }
  if (batch.retainUntil && batch.retainUntil.getTime() < now.getTime()) {
    return { ok: false, reason: "This batch's images have expired." };
  }
  const rows = await db
    .select()
    .from(batchRows)
    .where(and(eq(batchRows.batchId, batch.id), eq(batchRows.status, "ok")))
    .orderBy(asc(batchRows.idx));
  const withData = rows.filter((r) => r.data);
  if (withData.length === 0) {
    return { ok: false, reason: "Nothing to download yet." };
  }
  // Duplicate keys would otherwise produce two entries of the same name,
  // and most extractors silently keep only one.
  const used = new Set<string>();
  const entries = withData.map((r) => {
    let name = r.filename ?? `card-${r.idx + 1}.png`;
    if (used.has(name)) name = `${r.idx + 1}-${name}`;
    used.add(name);
    return {
      name,
      data: Buffer.from(r.data!, "base64"),
      date: r.renderedAt ?? now,
    };
  });
  return { ok: true, zip: buildZip(entries), entries: entries.length };
}

/** Drops stored images past their retention window. */
export async function purgeExpired(
  db: Database,
  userId: string,
  now: Date = new Date()
): Promise<number> {
  const expired = await db
    .select({ id: batches.id })
    .from(batches)
    .where(and(eq(batches.userId, userId), lt(batches.retainUntil, now)));
  for (const b of expired) {
    await db
      .update(batchRows)
      .set({ data: null })
      .where(eq(batchRows.batchId, b.id));
  }
  return expired.length;
}

export async function deleteBatch(
  db: Database,
  userId: string,
  id: string
): Promise<boolean> {
  const existing = await getOwnedBatch(db, userId, id);
  if (!existing) return false;
  await db
    .delete(batches)
    .where(and(eq(batches.id, id), eq(batches.userId, userId)));
  return true;
}
