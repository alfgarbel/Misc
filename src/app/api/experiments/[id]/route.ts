import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  compareAll,
  deleteExperiment,
  experimentTotals,
  getOwnedExperiment,
  updateExperiment,
  variantsOf,
  variantsSchema,
} from "@/lib/experiments";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z.string().max(40).optional(),
  status: z.enum(["running", "stopped"]).optional(),
  variants: variantsSchema.optional(),
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
  const db = getDb();
  const row = await getOwnedExperiment(db, user.id, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const variants = variantsOf(row);
  if (!variants.success) {
    return NextResponse.json({ error: variants.error }, { status: 500 });
  }
  const totals = await experimentTotals(db, row);
  return NextResponse.json({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    variants: variants.data,
    totals,
    comparisons: compareAll(totals),
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
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.path.join(".")}: ${issue.message}` },
      { status: 400 }
    );
  }
  const row = await updateExperiment(getDb(), user.id, id, parsed.data);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    experiment: { id: row.id, name: row.name, slug: row.slug, status: row.status },
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
  const deleted = await deleteExperiment(getDb(), user.id, id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
