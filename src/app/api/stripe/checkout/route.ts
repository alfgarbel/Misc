import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { subscriptions } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  getStripe,
  stripeConfigured,
  priceIdForPlan,
  checkoutSessionParams,
} from "@/lib/stripe";

export const runtime = "nodejs";

const bodySchema = z.object({ plan: z.enum(["pro", "scale"]) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Set the STRIPE_* environment variables." },
      { status: 503 }
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  const priceId = priceIdForPlan(parsed.data.plan);
  if (!priceId) {
    return NextResponse.json(
      { error: `Missing Stripe price ID for the ${parsed.data.plan} plan` },
      { status: 503 }
    );
  }

  const db = getDb();
  const stripe = getStripe();
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, user.id),
  });

  let customerId = sub?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await db
      .insert(subscriptions)
      .values({ userId: user.id, stripeCustomerId: customerId })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { stripeCustomerId: customerId },
      });
  }

  // The site advertises a number from PLANS; Stripe charges whatever the
  // price ID says. Nothing keeps those two in step, so when they drift a
  // customer is quietly charged something other than what they agreed to.
  // Checkout still proceeds — Stripe is the authority on what is owed — but
  // the mismatch is loud in the logs rather than silent.
  try {
    const price = await stripe.prices.retrieve(priceId);
    const advertisedCents = PLANS[parsed.data.plan].priceMonthlyUsd * 100;
    if (
      price.unit_amount !== null &&
      price.unit_amount !== advertisedCents
    ) {
      console.error(
        `Stripe price mismatch for the ${parsed.data.plan} plan: the site advertises ` +
          `$${PLANS[parsed.data.plan].priceMonthlyUsd} but ${priceId} charges ` +
          `${(price.unit_amount / 100).toFixed(2)} ${price.currency}. ` +
          `Update the Stripe price or PLANS so they agree.`
      );
    }
  } catch (err) {
    // A lookup failure must never block a sale.
    console.error("Could not verify the Stripe price before checkout:", err);
  }

  const session = await stripe.checkout.sessions.create(
    checkoutSessionParams({ priceId, customerId, userId: user.id })
  );

  return NextResponse.json({ url: session.url });
}
