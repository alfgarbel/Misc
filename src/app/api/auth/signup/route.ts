import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, subscriptions } from "@/lib/db/schema";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { createApiKey } from "@/lib/keys";
import { generateSigningSecret } from "@/lib/signing";
import { createAuthToken } from "@/lib/tokens";
import { sendEmail, verificationEmail } from "@/lib/mailer";
import { appUrl } from "@/lib/stripe";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const limiter = makeRateLimiter(5);

const bodySchema = z.object({
  email: z.string().email().max(254),
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
  const email = parsed.data.email.toLowerCase().trim();
  const db = getDb();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email,
    passwordHash: await hashPassword(parsed.data.password),
    signingSecret: generateSigningSecret(),
  });
  await db.insert(subscriptions).values({ userId, plan: "free" });
  const created = await createApiKey(db, userId, "Default");
  const apiKey = created?.key ?? null;
  await setSessionCookie(userId);

  // Fire-and-forget verification email; signup must not fail if mail does.
  try {
    const token = await createAuthToken(db, userId, "verify");
    void sendEmail({
      to: email,
      ...verificationEmail(`${appUrl()}/verify?token=${token}`),
    });
  } catch (err) {
    console.error("verification email failed:", err);
  }

  // The plaintext key is returned once, at signup, so the dashboard can show it.
  return NextResponse.json({ ok: true, apiKey });
}
