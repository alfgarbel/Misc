import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { validateLogoDataUrl, MAX_LOGO_DATA_URL_LENGTH } from "@/lib/brand";

export const runtime = "nodejs";

const bodySchema = z.object({
  logo: z.string().max(MAX_LOGO_DATA_URL_LENGTH * 2),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const check = validateLogoDataUrl(parsed.data.logo);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }
  await getDb()
    .update(users)
    .set({ brandLogo: parsed.data.logo })
    .where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  await getDb()
    .update(users)
    .set({ brandLogo: null })
    .where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
