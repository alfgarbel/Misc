import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getDb } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { getStripe, planForPriceId } from "@/lib/stripe";
import { applySubscriptionChange } from "@/lib/billing";

export const runtime = "nodejs";

function subscriptionDetails(sub: Stripe.Subscription): {
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
} {
  const item = sub.items.data[0];
  const plan = item ? planForPriceId(item.price.id) ?? "free" : "free";
  const periodEnd = item?.current_period_end;
  return {
    plan: sub.status === "canceled" ? "free" : plan,
    status: sub.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  };
}

async function updateByCustomerId(
  customerId: string,
  set: Partial<typeof subscriptions.$inferInsert>
) {
  await applySubscriptionChange(getDb(), customerId, set);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      await req.text(),
      signature,
      secret
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getDb();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!userId || !customerId || !subscriptionId) break;

      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
      const details = subscriptionDetails(sub);
      await db
        .insert(subscriptions)
        .values({
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          ...details,
        })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            ...details,
          },
        });
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await updateByCustomerId(customerId, {
        stripeSubscriptionId: sub.id,
        ...subscriptionDetails(sub),
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await updateByCustomerId(customerId, {
        stripeSubscriptionId: null,
        plan: "free",
        status: "canceled",
        currentPeriodEnd: null,
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
