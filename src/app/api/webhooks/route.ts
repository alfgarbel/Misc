import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import {
  countWebhooks,
  createWebhook,
  eventsSchema,
  listWebhooks,
  parseEvents,
} from "@/lib/webhooks";

export const runtime = "nodejs";

const bodySchema = z.object({
  url: z.string().min(1).max(2000),
  events: eventsSchema.optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const db = getDb();
  const [rows, plan] = await Promise.all([
    listWebhooks(db, user.id),
    getUserPlan(db, user.id),
  ]);
  return NextResponse.json({
    // The secret is never listed; it is shown once, when created.
    webhooks: rows.map((w) => ({
      id: w.id,
      url: w.url,
      events: parseEvents(w.events),
      active: w.active,
      lastStatus: w.lastStatus,
      lastDeliveredAt: w.lastDeliveredAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
    })),
    limit: PLANS[plan].webhooks,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a URL" }, { status: 400 });
  }

  const db = getDb();
  const plan = await getUserPlan(db, user.id);
  const limit = PLANS[plan].webhooks;
  if ((await countWebhooks(db, user.id)) >= limit) {
    return NextResponse.json(
      {
        error: `Your plan includes ${limit} ${
          limit === 1 ? "endpoint" : "endpoints"
        }. Remove one, or upgrade for more.`,
      },
      { status: 402 }
    );
  }

  const result = await createWebhook(db, user.id, {
    url: parsed.data.url,
    events: parsed.data.events ?? ["*"],
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    webhook: {
      id: result.webhook.id,
      url: result.webhook.url,
      events: parseEvents(result.webhook.events),
      // Shown once. It is not retrievable afterwards.
      secret: result.webhook.secret,
    },
  });
}
