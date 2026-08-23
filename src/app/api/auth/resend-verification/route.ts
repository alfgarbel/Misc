import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createAuthToken } from "@/lib/tokens";
import { sendEmail, verificationEmail } from "@/lib/mailer";
import { appUrl } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (user.emailVerifiedAt) {
    return NextResponse.json({ ok: true, message: "Already verified" });
  }
  const token = await createAuthToken(getDb(), user.id, "verify");
  const sent = await sendEmail({
    to: user.email,
    ...verificationEmail(`${appUrl()}/verify?token=${token}`),
  });
  if (!sent) {
    return NextResponse.json(
      { error: "Could not send the email. Try again later." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, message: "Verification email sent" });
}
