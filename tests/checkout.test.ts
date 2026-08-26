import { describe, it, expect, beforeEach } from "vitest";
import { checkoutSessionParams, stripeTaxEnabled } from "@/lib/stripe";

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
