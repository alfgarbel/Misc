import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { templateSpecSchema } from "@/lib/og/spec";
import {
  deleteTemplate,
  getOwnedTemplate,
  specOf,
  updateTemplate,
} from "@/lib/templates";
import { bumpCacheVersion } from "@/lib/cachebust";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z.string().max(40).optional(),
  spec: templateSpecSchema.optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const { id } = await params;
  const row = await getOwnedTemplate(getDb(), user.id, id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const spec = specOf(row);
  if (!spec.success) {
    return NextResponse.json({ error: spec.error }, { status: 500 });
  }
  return NextResponse.json({
    id: row.id,
    name: row.name,
    slug: row.slug,
    spec: spec.data,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.path.join(".")}: ${issue.message}` },
      { status: 400 }
    );
  }
  const db = getDb();
  const row = await updateTemplate(db, user.id, id, parsed.data);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // A design change leaves every already-published card stale, exactly like
  // a brand change does.
  const version = await bumpCacheVersion(db, user.id, { brandChanged: true });
  return NextResponse.json({
    ok: true,
    template: { id: row.id, name: row.name, slug: row.slug },
    version,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const { id } = await params;
  const deleted = await deleteTemplate(getDb(), user.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
