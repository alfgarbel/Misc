import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteWebhook,
  getOwnedWebhook,
  listDeliveries,
  setWebhookActive,
} from "@/lib/webhooks";

export const runtime = "nodejs";

const patchSchema = z.object({ active: z.boolean() });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const webhook = await getOwnedWebhook(db, user.id, id);
  if (!webhook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deliveries = await listDeliveries(db, webhook.id);
  return NextResponse.json({
    id: webhook.id,
    url: webhook.url,
    active: webhook.active,
    deliveries: deliveries.map((d) => ({
      id: d.id,
      event: d.event,
      status: d.status,
      attempts: d.attempts,
      error: d.error,
      createdAt: d.createdAt.toISOString(),
      deliveredAt: d.deliveredAt?.toISOString() ?? null,
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const ok = await setWebhookActive(getDb(), user.id, id, parsed.data.active);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteWebhook(getDb(), user.id, id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
