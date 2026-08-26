import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
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

  const session = await stripe.checkout.sessions.create(
    checkoutSessionParams({ priceId, customerId, userId: user.id })
  );

  return NextResponse.json({ url: session.url });
}
