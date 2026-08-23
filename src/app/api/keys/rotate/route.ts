import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rotateApiKey } from "@/lib/keys";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const apiKey = await rotateApiKey(getDb(), user.id);
  return NextResponse.json({ ok: true, apiKey });
}
