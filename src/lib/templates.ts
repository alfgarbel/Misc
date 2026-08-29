import { randomUUID } from "crypto";
import { and, eq, sql, desc } from "drizzle-orm";
import type { Database } from "./db";
import { templates } from "./db/schema";
import type { TemplateRow } from "./db/schema";
import {
  parseSpec,
  specAssetIds,
  templateSpecSchema,
  type TemplateSpec,
} from "./og/spec";

/** URL-safe and stable: this is what goes in ?tpl= on every published card. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return base || "template";
}

/** Appends -2, -3 … until the slug is free for this account. */
export async function uniqueSlug(
  db: Database,
  userId: string,
  desired: string
): Promise<string> {
  const base = slugify(desired);
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`.slice(0, 40);
    const clash = await db.query.templates.findFirst({
      where: and(eq(templates.userId, userId), eq(templates.slug, candidate)),
      columns: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 6)}`.slice(0, 40);
}

export async function countTemplates(
  db: Database,
  userId: string
): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(templates)
    .where(eq(templates.userId, userId));
  return count;
}

export async function listTemplates(
  db: Database,
  userId: string
): Promise<TemplateRow[]> {
  return db
    .select()
    .from(templates)
    .where(eq(templates.userId, userId))
    .orderBy(desc(templates.updatedAt));
}

/** A template that points at a given asset. */
export interface AssetUse {
  id: string;
  name: string;
  slug: string;
}

/**
 * Which templates reference each asset, keyed by asset id.
 *
 * Deleting an asset a template still points at breaks every card that
 * template renders, so this is what the editor shows next to each file —
 * before you try to delete it, rather than as a refusal afterwards.
 *
 * This reflects saved templates. The design open in the editor may have
 * unsaved changes, so the editor treats its own live spec as the truth for
 * itself and uses this for every other template.
 */
export async function assetUsage(
  db: Database,
  userId: string
): Promise<Record<string, AssetUse[]>> {
  const rows = await listTemplates(db, userId);
  const usage: Record<string, AssetUse[]> = {};
  for (const row of rows) {
    const spec = parseSpec(row.spec);
    // An unparseable template still renders nothing, but it also cannot be
    // proven to be free of the asset — skipping it only ever under-reports,
    // and the delete route runs the same code, so both agree.
    if (!spec.success) continue;
    for (const assetId of specAssetIds(spec.data)) {
      (usage[assetId] ??= []).push({
        id: row.id,
        name: row.name,
        slug: row.slug,
      });
    }
  }
  return usage;
}

/** Always scoped by user: a template id alone must never grant access. */
export async function getOwnedTemplate(
  db: Database,
  userId: string,
  id: string
): Promise<TemplateRow | null> {
  const row = await db.query.templates.findFirst({
    where: and(eq(templates.id, id), eq(templates.userId, userId)),
  });
  return row ?? null;
}

export async function getTemplateBySlug(
  db: Database,
  userId: string,
  slug: string
): Promise<TemplateRow | null> {
  const row = await db.query.templates.findFirst({
    where: and(eq(templates.userId, userId), eq(templates.slug, slug)),
  });
  return row ?? null;
}

export async function createTemplate(
  db: Database,
  userId: string,
  input: { name: string; slug?: string; spec: TemplateSpec }
): Promise<TemplateRow> {
  const now = new Date();
  const row: TemplateRow = {
    id: randomUUID(),
    userId,
    slug: await uniqueSlug(db, userId, input.slug || input.name),
    name: input.name.slice(0, 80) || "Untitled",
    spec: JSON.stringify(templateSpecSchema.parse(input.spec)),
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(templates).values(row);
  return row;
}

export async function updateTemplate(
  db: Database,
  userId: string,
  id: string,
  input: { name?: string; slug?: string; spec?: TemplateSpec }
): Promise<TemplateRow | null> {
  const existing = await getOwnedTemplate(db, userId, id);
  if (!existing) return null;

  let slug = existing.slug;
  if (input.slug && input.slug !== existing.slug) {
    slug = isValidSlug(input.slug)
      ? await uniqueSlug(db, userId, input.slug)
      : existing.slug;
  }
  const patch = {
    ...(input.name !== undefined ? { name: input.name.slice(0, 80) || "Untitled" } : {}),
    slug,
    ...(input.spec !== undefined
      ? { spec: JSON.stringify(templateSpecSchema.parse(input.spec)) }
      : {}),
    updatedAt: new Date(),
  };
  await db
    .update(templates)
    .set(patch)
    .where(and(eq(templates.id, id), eq(templates.userId, userId)));
  return { ...existing, ...patch };
}

export async function deleteTemplate(
  db: Database,
  userId: string,
  id: string
): Promise<boolean> {
  const existing = await getOwnedTemplate(db, userId, id);
  if (!existing) return false;
  await db
    .delete(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, userId)));
  return true;
}

/** Decodes a stored row, rejecting a spec the current schema can't render. */
export function specOf(row: TemplateRow) {
  return parseSpec(row.spec);
}
