import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  createApiKey,
  listActiveKeys,
  MAX_ACTIVE_KEYS,
  MAX_KEY_NAME_LENGTH,
} from "@/lib/keys";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const keys = await listActiveKeys(getDb(), user.id);
  return NextResponse.json({ keys });
}

const bodySchema = z.object({
  name: z.string().min(1).max(MAX_KEY_NAME_LENGTH).default("Default"),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid key name" }, { status: 400 });
  }
  const created = await createApiKey(getDb(), user.id, parsed.data.name);
  if (!created) {
    return NextResponse.json(
      { error: `Limit reached: at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.` },
      { status: 409 }
    );
  }
  // The plaintext key is returned once, at creation.
  return NextResponse.json({ ok: true, id: created.id, apiKey: created.key });
}
