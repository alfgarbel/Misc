import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { consumeAuthToken } from "@/lib/tokens";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const limiter = makeRateLimiter(5);

const bodySchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function POST(req: NextRequest) {
  if (limiter.limited(clientIp(req.headers))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const db = getDb();
  const userId = await consumeAuthToken(db, parsed.data.token, "reset");
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(eq(users.id, userId));
  await setSessionCookie(userId);
  return NextResponse.json({ ok: true });
}
