import { describe, it, expect, beforeEach } from "vitest";
import {
  checkoutSessionParams,
  planForPriceId,
  priceIdForPlan,
  stripeTaxEnabled,
  yearlyBillingAvailable,
} from "@/lib/stripe";
import { PLANS } from "@/lib/plans";

const opts = {
  priceId: "price_123",
  customerId: "cus_123",
  userId: "user-abc",
};

beforeEach(() => {
  delete process.env.STRIPE_TAX_ENABLED;
  process.env.NEXT_PUBLIC_APP_URL = "https://ogsmith.app";
});

describe("checkout session", () => {
  it("always carries the subscription essentials", () => {
    const p = checkoutSessionParams(opts);
    expect(p.mode).toBe("subscription");
    expect(p.customer).toBe("cus_123");
    expect(p.client_reference_id).toBe("user-abc");
    expect(p.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
    expect(p.allow_promotion_codes).toBe(true);
    expect(p.success_url).toBe("https://ogsmith.app/dashboard?upgraded=1");
    expect(p.cancel_url).toBe("https://ogsmith.app/pricing");
  });

  it("requests no tax until explicitly switched on", () => {
    const p = checkoutSessionParams(opts);
    expect(p.automatic_tax).toBeUndefined();
    expect(p.tax_id_collection).toBeUndefined();
    expect(p.billing_address_collection).toBeUndefined();
    expect(p.customer_update).toBeUndefined();
  });

  it("treats any value other than \"true\" as off", () => {
    for (const v of ["", "false", "1", "yes", "TRUE"]) {
      process.env.STRIPE_TAX_ENABLED = v;
      expect(stripeTaxEnabled(), `value ${JSON.stringify(v)}`).toBe(false);
      expect(checkoutSessionParams(opts).automatic_tax).toBeUndefined();
    }
  });

  it("adds VAT calculation when switched on", () => {
    process.env.STRIPE_TAX_ENABLED = "true";
    const p = checkoutSessionParams(opts);
    expect(p.automatic_tax).toEqual({ enabled: true });
    // Lets EU businesses supply a VAT number so reverse charge applies.
    expect(p.tax_id_collection).toEqual({ enabled: true });
    // The rate can't be determined without the customer's country.
    expect(p.billing_address_collection).toBe("required");
    // Stripe rejects automatic_tax on an existing customer without this.
    expect(p.customer_update).toEqual({ address: "auto", name: "auto" });
  });

  it("keeps the essentials intact when tax is on", () => {
    process.env.STRIPE_TAX_ENABLED = "true";
    const p = checkoutSessionParams(opts);
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
    expect(p.allow_promotion_codes).toBe(true);
    expect(p.client_reference_id).toBe("user-abc");
  });
});

describe("yearly billing", () => {
  const keys = ["STRIPE_PRICE_PRO", "STRIPE_PRICE_SCALE", "STRIPE_PRICE_PRO_YEARLY", "STRIPE_PRICE_SCALE_YEARLY"];
  beforeEach(() => {
    for (const k of keys) delete process.env[k];
  });

  it("is offered only once both yearly prices exist", () => {
    expect(yearlyBillingAvailable()).toBe(false);
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_y";
    expect(yearlyBillingAvailable()).toBe(false);
    process.env.STRIPE_PRICE_SCALE_YEARLY = "price_scale_y";
    expect(yearlyBillingAvailable()).toBe(true);
  });

  it("maps both intervals to the same plan", () => {
    process.env.STRIPE_PRICE_PRO = "price_pro_m";
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_y";
    process.env.STRIPE_PRICE_SCALE_YEARLY = "price_scale_y";
    expect(priceIdForPlan("pro")).toBe("price_pro_m");
    expect(priceIdForPlan("pro", "year")).toBe("price_pro_y");
    expect(priceIdForPlan("scale", "month")).toBeNull();
    expect(planForPriceId("price_pro_y")).toBe("pro");
    expect(planForPriceId("price_scale_y")).toBe("scale");
    expect(planForPriceId("price_other")).toBeNull();
  });

  it("charges ten months for a year", () => {
    expect(PLANS.pro.priceYearlyUsd).toBe(PLANS.pro.priceMonthlyUsd * 10);
    expect(PLANS.scale.priceYearlyUsd).toBe(PLANS.scale.priceMonthlyUsd * 10);
  });
});
