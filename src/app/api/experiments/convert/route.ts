import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { resolveApiKey } from "@/lib/keys";
import { isValidSlug } from "@/lib/templates";
import { getExperimentBySlug, recordConversion } from "@/lib/experiments";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const limiter = makeRateLimiter(240);

const bodySchema = z.object({
  exp: z.string().max(40),
  k: z.string().min(1).max(500),
});

/**
 * Records an outcome for a page.
 *
 * OGsmith cannot see clicks: a card is fetched once by a crawler and shown
 * by the platform to everyone, so nothing about a human's behaviour ever
 * reaches this service. Outcomes therefore have to be reported by whoever
 * can see them — the caller's own analytics — and this is where they land.
 */
export async function POST(req: NextRequest) {
  const key =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }
  if (limiter.limited(clientIp(req.headers))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send exp and k" },
      { status: 400 }
    );
  }
  if (!isValidSlug(parsed.data.exp)) {
    return NextResponse.json(
      { error: "exp must be an experiment slug" },
      { status: 400 }
    );
  }

  const db = getDb();
  const resolved = await resolveApiKey(db, key);
  if (!resolved) {
    return NextResponse.json(
      { error: "Invalid or revoked API key" },
      { status: 401 }
    );
  }
  const experiment = await getExperimentBySlug(db, resolved.userId, parsed.data.exp);
  if (!experiment) {
    return NextResponse.json({ error: "No such experiment" }, { status: 404 });
  }

  const recorded = await recordConversion(db, experiment.id, parsed.data.k);
  if (!recorded) {
    // Reporting an outcome for a page that never rendered a card would put
    // a conversion in an arm with no exposure, quietly skewing the result.
    return NextResponse.json(
      { error: "That page has no assignment in this experiment yet" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
