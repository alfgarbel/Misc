import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { templateSpecSchema, starterSpec } from "@/lib/og/spec";
import { countTemplates, createTemplate, listTemplates } from "@/lib/templates";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().max(40).optional(),
  spec: templateSpecSchema.optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const db = getDb();
  const [rows, plan] = await Promise.all([
    listTemplates(db, user.id),
    getUserPlan(db, user.id),
  ]);
  return NextResponse.json({
    templates: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      updatedAt: r.updatedAt.toISOString(),
    })),
    limit: PLANS[plan].templates,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const db = getDb();
  const plan = await getUserPlan(db, user.id);
  const limit = PLANS[plan].templates;
  if ((await countTemplates(db, user.id)) >= limit) {
    return NextResponse.json(
      {
        error: `Your plan includes ${limit} saved ${
          limit === 1 ? "template" : "templates"
        }. Delete one, or upgrade for more.`,
      },
      { status: 402 }
    );
  }
  const row = await createTemplate(db, user.id, {
    name: parsed.data.name,
    slug: parsed.data.slug,
    spec: parsed.data.spec ?? starterSpec(),
  });
  return NextResponse.json({
    ok: true,
    template: { id: row.id, name: row.name, slug: row.slug },
  });
}
