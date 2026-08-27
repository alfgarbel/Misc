import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import {
  countExperiments,
  createExperiment,
  experimentTotals,
  listExperiments,
  starterVariants,
  variantsSchema,
} from "@/lib/experiments";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().max(40).optional(),
  variants: variantsSchema.optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const db = getDb();
  const [rows, plan] = await Promise.all([
    listExperiments(db, user.id),
    getUserPlan(db, user.id),
  ]);
  const withTotals = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
      totals: await experimentTotals(db, row),
    }))
  );
  return NextResponse.json({
    experiments: withTotals,
    limit: PLANS[plan].experiments,
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
  const limit = PLANS[plan].experiments;
  if ((await countExperiments(db, user.id)) >= limit) {
    return NextResponse.json(
      {
        error: `Your plan includes ${limit} ${
          limit === 1 ? "experiment" : "experiments"
        }. Stop one, or upgrade for more.`,
      },
      { status: 402 }
    );
  }
  const row = await createExperiment(db, user.id, {
    name: parsed.data.name,
    slug: parsed.data.slug,
    variants: parsed.data.variants ?? starterVariants(),
  });
  return NextResponse.json({
    ok: true,
    experiment: { id: row.id, name: row.name, slug: row.slug },
  });
}
