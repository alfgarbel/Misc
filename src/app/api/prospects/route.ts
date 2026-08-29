import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { createScan, listScans, parseLines, MAX_SITES } from "@/lib/prospects";

export const runtime = "nodejs";

/**
 * Prospecting reads other people's sites on our servers, so it is gated to
 * the account owner rather than to any logged-in user. A 404 rather than a
 * 403, matching the admin page it is called from.
 */
async function admin() {
  const user = await getCurrentUser().catch(() => null);
  return user && isAdminUser(user) ? user : null;
}

const bodySchema = z.object({
  name: z.string().max(80).optional(),
  tier: z.enum(["strict", "wide"]).optional(),
  sites: z.string().min(1).max(60_000),
});

export async function GET() {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ scans: await listScans(getDb(), user.id) });
}

export async function POST(req: NextRequest) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste at least one site" }, { status: 400 });
  }
  const lines = parseLines(parsed.data.sites);
  if (lines.length === 0) {
    return NextResponse.json(
      { error: "Nothing to scan — every line was blank or a comment." },
      { status: 400 }
    );
  }

  const scan = await createScan(getDb(), user.id, {
    name: parsed.data.name,
    tier: parsed.data.tier,
    lines,
  });
  return NextResponse.json({
    ok: true,
    scan,
    // Said out loud so a list trimmed at the cap isn't a silent surprise.
    truncated: lines.length >= MAX_SITES,
  });
}
