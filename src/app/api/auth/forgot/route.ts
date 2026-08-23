import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createAuthToken } from "@/lib/tokens";
import { sendEmail, resetEmail } from "@/lib/mailer";
import { appUrl } from "@/lib/stripe";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const limiter = makeRateLimiter(5);

const bodySchema = z.object({ email: z.string().email().max(254) });

export async function POST(req: NextRequest) {
  if (limiter.limited(clientIp(req.headers))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Always answer 200 so the endpoint can't be used to enumerate accounts.
  if (user) {
    try {
      const token = await createAuthToken(db, user.id, "reset");
      void sendEmail({
        to: email,
        ...resetEmail(`${appUrl()}/reset?token=${token}`),
      });
    } catch (err) {
      console.error("reset email failed:", err);
    }
  }
  return NextResponse.json({
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  });
}
