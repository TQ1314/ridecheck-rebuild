import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  order: {} as Record<string, any>,
  contextFailure: null as Error | null,
  contextMissing: false,
  providerSend: vi.fn(),
  from: vi.fn(),
  event: {} as any,
}));

// Keep both email modules and the webhook real; isolate only external boundaries.
vi.mock("resend", () => ({
  Resend: class { emails = { send: mocks.providerSend }; },
}));
vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({ webhooks: { constructEvent: () => mocks.event } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/notifications/notifyOps", () => ({ notifyOpsTeam: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/staging-capture", () => ({
  stagingCaptureEnabled: () => false,
  captureStagingNotification: () => { throw new Error("Unexpected capture path"); },
}));

const listing = "https://facebook.com/marketplace/item/test-only-123";
const replyInstruction =
  "Once the seller confirms, reply to this message with the confirmed date, time, and vehicle address.";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "re_test_fixture_only");
  vi.stubEnv("RESEND_FROM_EMAIL", "sender@example.test");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_fixture_only");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External networking prohibited"); }));
  mocks.providerSend.mockResolvedValue({ data: { id: "test-message" }, error: null });
  mocks.contextFailure = null;
  mocks.contextMissing = false;
  mocks.order = {
    id: "test-order",
    customer_id: "test-customer",
    payment_status: "unpaid",
    buyer_email: "buyer@example.test",
    order_number: "RC-TEST",
    vehicle_year: 2021,
    vehicle_make: "Toyota",
    vehicle_model: "Camry",
    package: "standard",
    final_price: 129,
    booking_type: "self_arrange",
    platform_source: "facebook_marketplace",
    listing_url: listing,
    preferred_date: "2026-10-05",
    tracking_token: "test-tracking",
    stripe_checkout_session_id: "cs_test_fixture",
    stripe_session_id: "cs_test_fixture",
    payment_link_token: "test-token",
    ops_status: "new",
  };
  mocks.event = {
    id: "evt_test_fixture",
    livemode: false,
    type: "checkout.session.completed",
    data: { object: {
      id: "cs_test_fixture",
      livemode: false,
      mode: "payment",
      payment_status: "paid",
      amount_total: 12900,
      currency: "usd",
      payment_intent: "pi_test_fixture",
      metadata: { order_id: "test-order", payment_link_token: "test-token" },
      customer_details: { email: "buyer@example.test" },
    } },
  };
  mocks.from.mockImplementation((table: string) => {
    if (table === "activity_log") return { insert: async () => ({ error: null }) };
    if (table !== "orders") throw new Error(`Unexpected fixture table: ${table}`);
    let update: Record<string, any> | null = null;
    let contextLookup = false;
    const builder: any = {
      select: (columns: string) => {
        contextLookup = columns === "booking_type, listing_url, platform_source, preferred_date";
        if (update) {
          Object.assign(mocks.order, update);
          return Promise.resolve({ data: [{ id: mocks.order.id }], error: null });
        }
        return builder;
      },
      update: (payload: Record<string, any>) => { update = payload; return builder; },
      eq: () => builder,
      neq: () => builder,
      is: () => builder,
      maybeSingle: async () => ({
        data: contextLookup && (mocks.contextFailure || mocks.contextMissing) ? null : mocks.order,
        error: contextLookup ? mocks.contextFailure : null,
      }),
    };
    builder.single = builder.maybeSingle;
    return builder;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function sendThroughPaymentWebhook() {
  const { POST } = await import("../route");
  const response = await POST(new Request("https://example.test/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "synthetic-test-signature" },
    body: "{}",
  }) as any);
  expect(response.status).toBe(200);
  expect(mocks.order.payment_status).toBe("paid");
  expect(mocks.providerSend).toHaveBeenCalledTimes(1);
  expect(mocks.providerSend.mock.calls[0][0].to).toBe("buyer@example.test");
  return mocks.providerSend.mock.calls[0][0];
}

async function originalStandardConfirmation() {
  mocks.providerSend.mockClear();
  // Baseline: unchanged webhook output passed through the original sender contract.
  vi.doMock("@/lib/email/resend", () => ({
    sendEmail: async (message: any) => {
      const transport: any = {
        from: "RideCheck <sender@example.test>",
        to: message.to, subject: message.subject, html: message.html,
      };
      if (message.replyTo) transport.reply_to = message.replyTo;
      await mocks.providerSend(transport);
      return { success: true };
    },
  }));
  vi.resetModules();
  mocks.order.payment_status = "unpaid";
  try { return await sendThroughPaymentWebhook(); }
  finally { vi.doUnmock("@/lib/email/resend"); }
}

describe("actual payment-webhook paid-confirmation email path", () => {
  it("sends the requested date, original listing and exact reply instruction for Facebook Self-Arrange", async () => {
    const message = await sendThroughPaymentWebhook();
    expect(message.html).toContain("2026-10-05");
    expect(message.html).toContain(listing);
    expect(message.html).toContain(replyInstruction);
    expect(message.html).toContain("Your payment is confirmed. Your inspection appointment is not confirmed");
    expect(message.html).not.toContain("Your RideCheck assessment has been confirmed");
  });

  it("preserves Facebook instructions when a listing URL was not supplied", async () => {
    mocks.order.listing_url = null;
    const message = await sendThroughPaymentWebhook();
    expect(message.html).toContain("2026-10-05");
    expect(message.html).toContain(replyInstruction);
    expect(message.html).toContain("Not provided");
  });

  it.each(["lookup error", "missing context", "enrichment error"])(
    "still sends the original standard email and logs %s", async (failure) => {
      if (failure === "lookup error") mocks.contextFailure = new Error("Fixture context unavailable");
      if (failure === "missing context") mocks.contextMissing = true;
      if (failure === "enrichment error") mocks.order.preferred_date = {};
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const message = await sendThroughPaymentWebhook();
      expect(message.html).toContain("Your RideCheck assessment has been confirmed and is now in our queue.");
      expect(message.html).not.toContain("Facebook Marketplace");
      expect(log).toHaveBeenCalledWith(
        "[Paid confirmation enrichment failed; sending standard confirmation]",
        expect.objectContaining({
          orderId: "test-order",
          template: "buyer-paid-confirmation",
          reason: expect.any(String),
        }),
      );
      expect(message).toEqual(await originalStandardConfirmation());
    },
  );

  it.each(["non-Facebook", "historical Facebook Concierge"])(
    "preserves %s confirmation output byte-for-byte against the original sender", async (kind) => {
      if (kind === "non-Facebook") {
        mocks.order.platform_source = "craigslist";
        mocks.order.listing_url = null;
      } else mocks.order.booking_type = "concierge";
      const actual = await sendThroughPaymentWebhook();
      expect(actual).toEqual(await originalStandardConfirmation());
    },
  );
});