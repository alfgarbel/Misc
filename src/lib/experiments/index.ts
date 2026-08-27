import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { experiments, experimentAssignments } from "../db/schema";
import type { ExperimentRow } from "../db/schema";
import { slugify, isValidSlug } from "../templates";
import {
  assignVariant,
  parseVariants,
  type Variant,
} from "./spec";
import type { VariantTotals } from "./stats";

export * from "./spec";
export * from "./stats";

export async function listExperiments(
  db: Database,
  userId: string
): Promise<ExperimentRow[]> {
  return db
    .select()
    .from(experiments)
    .where(eq(experiments.userId, userId))
    .orderBy(desc(experiments.updatedAt));
}

/** Always scoped by user: an experiment id alone must never grant access. */
export async function getOwnedExperiment(
  db: Database,
  userId: string,
  id: string
): Promise<ExperimentRow | null> {
  const row = await db.query.experiments.findFirst({
    where: and(eq(experiments.id, id), eq(experiments.userId, userId)),
  });
  return row ?? null;
}

export async function getExperimentBySlug(
  db: Database,
  userId: string,
  slug: string
): Promise<ExperimentRow | null> {
  const row = await db.query.experiments.findFirst({
    where: and(eq(experiments.userId, userId), eq(experiments.slug, slug)),
  });
  return row ?? null;
}

async function uniqueSlug(
  db: Database,
  userId: string,
  desired: string
): Promise<string> {
  const base = slugify(desired);
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`.slice(0, 40);
    const clash = await getExperimentBySlug(db, userId, candidate);
    if (!clash) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 6)}`.slice(0, 40);
}

export async function countExperiments(
  db: Database,
  userId: string
): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(experiments)
    .where(eq(experiments.userId, userId));
  return count;
}

export async function createExperiment(
  db: Database,
  userId: string,
  input: { name: string; slug?: string; variants: Variant[] }
): Promise<ExperimentRow> {
  const now = new Date();
  const row: ExperimentRow = {
    id: randomUUID(),
    userId,
    slug: await uniqueSlug(db, userId, input.slug || input.name),
    name: input.name.slice(0, 80) || "Untitled experiment",
    status: "running",
    variants: JSON.stringify(input.variants),
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(experiments).values(row);
  return row;
}

export async function updateExperiment(
  db: Database,
  userId: string,
  id: string,
  input: {
    name?: string;
    slug?: string;
    status?: "running" | "stopped";
    variants?: Variant[];
  }
): Promise<ExperimentRow | null> {
  const existing = await getOwnedExperiment(db, userId, id);
  if (!existing) return null;
  let slug = existing.slug;
  if (input.slug && input.slug !== existing.slug) {
    slug = isValidSlug(input.slug)
      ? await uniqueSlug(db, userId, input.slug)
      : existing.slug;
  }
  const patch = {
    ...(input.name !== undefined
      ? { name: input.name.slice(0, 80) || "Untitled experiment" }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.variants !== undefined
      ? { variants: JSON.stringify(input.variants) }
      : {}),
    slug,
    updatedAt: new Date(),
  };
  await db
    .update(experiments)
    .set(patch)
    .where(and(eq(experiments.id, id), eq(experiments.userId, userId)));
  return { ...existing, ...patch };
}

export async function deleteExperiment(
  db: Database,
  userId: string,
  id: string
): Promise<boolean> {
  const existing = await getOwnedExperiment(db, userId, id);
  if (!existing) return false;
  await db
    .delete(experiments)
    .where(and(eq(experiments.id, id), eq(experiments.userId, userId)));
  return true;
}

export function variantsOf(row: ExperimentRow) {
  return parseVariants(row.variants);
}

export interface Assignment {
  variant: Variant;
  /** True when this page was seen for the first time on this call. */
  isNew: boolean;
}

/**
 * Returns the variant for a page, assigning one the first time and reusing
 * it forever after.
 *
 * Reuse is the point. A stored assignment survives changes to the
 * experiment's weights, so a post already shared keeps the artwork it was
 * shared with — otherwise editing an experiment would rewrite history and
 * mix both designs into the same result.
 */
export async function assignmentFor(
  db: Database,
  row: ExperimentRow,
  key: string,
  opts: { countExposure?: boolean } = {}
): Promise<Assignment | null> {
  const parsed = parseVariants(row.variants);
  if (!parsed.success) return null;
  const variants = parsed.data;
  const now = new Date();

  const existing = await db.query.experimentAssignments.findFirst({
    where: and(
      eq(experimentAssignments.experimentId, row.id),
      eq(experimentAssignments.key, key)
    ),
  });

  if (existing) {
    const variant =
      variants.find((v) => v.id === existing.variantId) ??
      // The variant was deleted from the experiment. Fall back rather than
      // failing the render, and leave the record alone so the history of
      // what was actually served stays honest.
      variants[0];
    if (opts.countExposure) {
      await db
        .update(experimentAssignments)
        .set({
          exposures: sql`${experimentAssignments.exposures} + 1`,
          lastSeenAt: now,
        })
        .where(
          and(
            eq(experimentAssignments.experimentId, row.id),
            eq(experimentAssignments.key, key)
          )
        );
    }
    return { variant, isNew: false };
  }

  const variant = assignVariant(row.slug, key, variants);
  if (!variant) return null;
  await db
    .insert(experimentAssignments)
    .values({
      experimentId: row.id,
      key,
      variantId: variant.id,
      exposures: opts.countExposure ? 1 : 0,
      conversions: 0,
      assignedAt: now,
      lastSeenAt: now,
    })
    // Two crawlers can hit a new page at the same moment; the first write
    // wins and the second must not error or reassign.
    .onConflictDoNothing();
  return { variant, isNew: true };
}

/**
 * Records an outcome for a page. Idempotency is the caller's problem — we
 * count what we are told, and the dashboard says so.
 */
export async function recordConversion(
  db: Database,
  experimentId: string,
  key: string
): Promise<boolean> {
  const existing = await db.query.experimentAssignments.findFirst({
    where: and(
      eq(experimentAssignments.experimentId, experimentId),
      eq(experimentAssignments.key, key)
    ),
  });
  if (!existing) return false;
  await db
    .update(experimentAssignments)
    .set({ conversions: sql`${experimentAssignments.conversions} + 1` })
    .where(
      and(
        eq(experimentAssignments.experimentId, experimentId),
        eq(experimentAssignments.key, key)
      )
    );
  return true;
}

/**
 * Zeroes the counters while leaving assignments in place.
 *
 * The two halves are deliberately separate. Editing what a variant looks
 * like invalidates the numbers gathered under the old design — they now
 * pool two different cards into one rate — but it must not re-randomise
 * anything, because pages already shared would change artwork. So results
 * restart and assignments stand.
 */
export async function resetResults(
  db: Database,
  experimentId: string
): Promise<number> {
  const rows = await db
    .select({ key: experimentAssignments.key })
    .from(experimentAssignments)
    .where(eq(experimentAssignments.experimentId, experimentId));
  await db
    .update(experimentAssignments)
    .set({ exposures: 0, conversions: 0 })
    .where(eq(experimentAssignments.experimentId, experimentId));
  return rows.length;
}

/** Per-variant totals, including variants that have seen nothing yet. */
export async function experimentTotals(
  db: Database,
  row: ExperimentRow
): Promise<VariantTotals[]> {
  const parsed = parseVariants(row.variants);
  if (!parsed.success) return [];
  const rows = await db
    .select({
      variantId: experimentAssignments.variantId,
      keys: sql<number>`count(*)`,
      exposures: sql<number>`coalesce(sum(${experimentAssignments.exposures}), 0)`,
      conversions: sql<number>`coalesce(sum(${experimentAssignments.conversions}), 0)`,
    })
    .from(experimentAssignments)
    .where(eq(experimentAssignments.experimentId, row.id))
    .groupBy(experimentAssignments.variantId);

  const byId = new Map(rows.map((r) => [r.variantId, r]));
  return parsed.data.map((variant) => {
    const hit = byId.get(variant.id);
    return {
      variantId: variant.id,
      label: variant.label,
      keys: hit?.keys ?? 0,
      exposures: hit?.exposures ?? 0,
      conversions: hit?.conversions ?? 0,
    };
  });
}
