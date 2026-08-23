import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const limiter = makeRateLimiter(10);

// A valid bcrypt hash of a random string; compared against when the email
// doesn't exist so response timing doesn't reveal account existence.
const DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const bodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
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
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Always run a hash comparison so unknown emails take the same time as
  // wrong passwords (no account-existence timing oracle).
  const ok = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_HASH
  );
  if (!user || !ok) {
    return NextResponse.json(
      { error: "Incorrect email or password" },
      { status: 401 }
    );
  }
  await setSessionCookie(user.id);
  return NextResponse.json({ ok: true });
}
