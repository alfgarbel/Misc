import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateSigningSecret, rotateSigningSecret } from "@/lib/signing";

export const runtime = "nodejs";

/** Returns the account's URL-signing secret (session required). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const secret = await getOrCreateSigningSecret(getDb(), user.id);
  return NextResponse.json({ accountId: user.id, secret });
}

/** Rotates the signing secret — previously signed URLs stop working. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const secret = await rotateSigningSecret(getDb(), user.id);
  return NextResponse.json({ accountId: user.id, secret });
}
