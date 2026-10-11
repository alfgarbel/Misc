import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
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

const bodySchema = z.object({
  plan: z.enum(["pro", "scale"]),
  interval: z.enum(["month", "year"]).default("month"),
});

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
  const { plan, interval } = parsed.data;
  const priceId = priceIdForPlan(plan, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `Missing Stripe price ID for the ${interval}ly ${plan} plan` },
      { status: 503 }
    );
  }

  const db = getDb();
  const stripe = getStripe();
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, user.id),
  });

  const createCustomer = async (): Promise<string> => {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    await db
      .insert(subscriptions)
      .values({ userId: user.id, stripeCustomerId: customer.id })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { stripeCustomerId: customer.id },
      });
    return customer.id;
  };

  let customerId = sub?.stripeCustomerId ?? (await createCustomer());

  // The site advertises a number from PLANS; Stripe charges whatever the
  // price ID says. Nothing keeps those two in step, so when they drift a
  // customer is quietly charged something other than what they agreed to.
  // Checkout still proceeds — Stripe is the authority on what is owed — but
  // the mismatch is loud in the logs rather than silent.
  try {
    const price = await stripe.prices.retrieve(priceId);
    const advertisedUsd =
      interval === "year" ? PLANS[plan].priceYearlyUsd : PLANS[plan].priceMonthlyUsd;
    const advertisedCents = advertisedUsd * 100;
    if (
      price.unit_amount !== null &&
      price.unit_amount !== advertisedCents
    ) {
      console.error(
        `Stripe price mismatch for the ${interval}ly ${plan} plan: the site advertises ` +
          `$${advertisedUsd} but ${priceId} charges ` +
          `${(price.unit_amount / 100).toFixed(2)} ${price.currency}. ` +
          `Update the Stripe price or PLANS so they agree.`
      );
    }
  } catch (err) {
    // A lookup failure must never block a sale.
    console.error("Could not verify the Stripe price before checkout:", err);
  }

  const createSession = (customer: string) =>
    stripe.checkout.sessions.create(
      checkoutSessionParams({ priceId, customerId: customer, userId: user.id })
    );

  try {
    let session;
    try {
      session = await createSession(customerId);
    } catch (err) {
      // A customer saved while the site ran on test keys doesn't exist in
      // live mode (and vice versa). Replace it instead of failing forever.
      if (!isMissingCustomer(err)) throw err;
      customerId = await createCustomer();
      session = await createSession(customerId);
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error(`Stripe checkout failed for the ${interval}ly ${plan} plan:`, err);
    const detail = err instanceof Stripe.errors.StripeError ? err.message : null;
    return NextResponse.json(
      { error: detail ? `Checkout failed: ${detail}` : "Checkout failed. Please try again." },
      { status: 502 }
    );
  }
}

function isMissingCustomer(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeError &&
    err.code === "resource_missing" &&
    err.param === "customer"
  );
}
