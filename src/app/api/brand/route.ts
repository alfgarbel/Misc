import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { TEMPLATES } from "@/lib/og/params";

export const runtime = "nodejs";

// Empty string clears a default.
const emptyToNull = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const bodySchema = z.object({
  template: z
    .union([z.enum(TEMPLATES), z.literal("")])
    .transform((v) => (v === "" ? null : v)),
  theme: z
    .union([z.enum(["dark", "light"]), z.literal("")])
    .transform((v) => (v === "" ? null : v)),
  accent: z
    .union([z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/), z.literal("")])
    .transform((v) => (v === "" ? null : v)),
  site: emptyToNull(100),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  await getDb()
    .update(users)
    .set({
      brandTemplate: parsed.data.template,
      brandTheme: parsed.data.theme,
      brandAccent: parsed.data.accent,
      brandSite: parsed.data.site,
    })
    .where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
