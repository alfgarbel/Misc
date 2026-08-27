import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveApiKey } from "@/lib/keys";
import { isValidSlug } from "@/lib/templates";
import { assignmentFor, getExperimentBySlug } from "@/lib/experiments";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const limiter = makeRateLimiter(120);

/**
 * Says which variant a page is in, without rendering anything.
 *
 * This exists so the assignment has exactly one source of truth. A caller
 * tags their own analytics with the variant they get here, and the number
 * they later report back lines up with the card that was actually served.
 * Deciding independently on both sides is how experiments end up measuring
 * two different things.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const key = params.get("key");
  const slug = params.get("exp");
  const contentKey = params.get("k");

  if (!key) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }
  if (limiter.limited(clientIp(req.headers))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  if (!slug || !isValidSlug(slug)) {
    return NextResponse.json(
      { error: "exp must be an experiment slug" },
      { status: 400 }
    );
  }
  if (!contentKey) {
    return NextResponse.json(
      { error: "k must identify the page under test" },
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
  const experiment = await getExperimentBySlug(db, resolved.userId, slug);
  if (!experiment) {
    return NextResponse.json({ error: "No such experiment" }, { status: 404 });
  }

  // Asking does not count as a render — an exposure means a card was
  // actually served.
  const assigned = await assignmentFor(db, experiment, contentKey.slice(0, 500));
  if (!assigned) {
    return NextResponse.json(
      { error: "Experiment has no usable variants" },
      { status: 500 }
    );
  }
  return NextResponse.json({
    experiment: experiment.slug,
    status: experiment.status,
    key: contentKey,
    variant: assigned.variant.id,
    label: assigned.variant.label,
    params: assigned.variant.params,
  });
}
