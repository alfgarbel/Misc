import Stripe from "stripe";
import type { PlanId } from "./plans";

let _stripe: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function priceIdForPlan(plan: "pro" | "scale"): string | null {
  const id =
    plan === "pro"
      ? process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_SCALE;
  return id ?? null;
}

export function planForPriceId(priceId: string): PlanId | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_SCALE) return "scale";
  return null;
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Whether to ask Stripe to calculate VAT. Gated by an env var because
 * enabling it before Stripe Tax is switched on in the dashboard makes
 * checkout fail — this way the code can ship ahead of the dashboard work.
 */
/**
 * Where "get in touch" points. Returned rather than hard-coded so no page
 * can advertise an address that doesn't exist — an unset variable hides
 * the link instead of publishing a mailto that bounces.
 */
export function contactEmail(): string | null {
  const raw = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return raw && raw.includes("@") ? raw : null;
}

export function stripeTaxEnabled(): boolean {
  return process.env.STRIPE_TAX_ENABLED === "true";
}

/**
 * Builds the Checkout session. Prices are treated as tax-exclusive in
 * Stripe, so VAT is added on top of the $9/$29 rather than carved out.
 */
export function checkoutSessionParams(opts: {
  priceId: string;
  customerId: string;
  userId: string;
}): Stripe.Checkout.SessionCreateParams {
  const base: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: opts.customerId,
    client_reference_id: opts.userId,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${appUrl()}/dashboard?upgraded=1`,
    cancel_url: `${appUrl()}/pricing`,
  };
  if (!stripeTaxEnabled()) return base;

  return {
    ...base,
    // Work out the right rate from the customer's location.
    automatic_tax: { enabled: true },
    // Let EU businesses enter a VAT number, which triggers reverse charge.
    tax_id_collection: { enabled: true },
    // Tax can't be determined without knowing where the customer is.
    billing_address_collection: "required",
    // Stripe rejects automatic_tax against an existing customer unless it is
    // allowed to write the address it just collected back to that customer.
    customer_update: { address: "auto", name: "auto" },
  };
}
