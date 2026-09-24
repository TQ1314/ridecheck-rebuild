import { describe, expect, it } from "vitest";
import { expectedStripeAmountCents, stripeObjectMatchesOrder, stripePaymentMatches } from "./stripe-validation";

describe("manual Stripe payment validation", () => {
  it("accepts the exact order amount and currency", () => {
    expect(stripePaymentMatches({
      expectedAmountCents: expectedStripeAmountCents({ orderPriceDollars: 139 }),
      expectedCurrency: "usd",
      receivedAmountCents: 13900,
      receivedCurrency: "USD",
    })).toBe(true);
  });

  it("rejects a successful but undersized payment", () => {
    expect(stripePaymentMatches({
      expectedAmountCents: 13900,
      expectedCurrency: "usd",
      receivedAmountCents: 100,
      receivedCurrency: "usd",
    })).toBe(false);
  });

  it("includes Stripe Tax and an enabled service fee", () => {
    expect(expectedStripeAmountCents({
      orderPriceDollars: 139,
      serviceFeeCents: 300,
      stripeTaxCents: 1250,
      includesTax: true,
    })).toBe(15450);
  });

  it("rejects a same-priced Stripe object belonging to another order", () => {
    expect(stripeObjectMatchesOrder({
      metadataOrderId: "other-order",
      targetOrderId: "target-order",
      alreadyLinked: false,
    })).toBe(false);
    expect(stripeObjectMatchesOrder({
      metadataOrderId: null,
      targetOrderId: "target-order",
      alreadyLinked: false,
    })).toBe(false);
  });
});