import { beforeEach, describe, expect, it, vi } from "vitest";

const { stripe, orderState, configuredEvent, notifyOps, sendEmail, updateFailure, supabaseFrom } = vi.hoisted(() => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
  },
  orderState: { current: null as Record<string, any> | null },
  configuredEvent: { current: null as any },
  notifyOps: vi.fn(),
  sendEmail: vi.fn(),
  updateFailure: { current: null as any },
  supabaseFrom: vi.fn(),
}));

vi.mock("@/lib/stripe/server", () => ({ getStripe: () => stripe }));
vi.mock("@/lib/notifications/notifyOps", () => ({ notifyOpsTeam: notifyOps }));
vi.mock("@/lib/email/resend", () => ({ sendEmail }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from: supabaseFrom } }));
vi.mock("@/lib/founding/credit-code", () => ({ generateCreditCode: () => "TEST-CODE" }));
vi.mock("@/lib/email/founding-supporter", () => ({
  buildSupporterConfirmationEmail: () => ({ subject: "supporter", html: "" }),
  buildGiftRecipientEmail: () => ({ subject: "gift", html: "" }),
}));

const defaultOrder = () => ({
  id: "order-1",
  payment_status: "pending",
  customer_id: "customer-1",
  buyer_email: "buyer@example.com",
  order_id: "RC-1",
  order_number: "RC-1",
  vehicle_year: "2023",
  vehicle_make: "Rivian",
  vehicle_model: "R1S",
  package: "exotic",
  final_price: 299,
  booking_type: "concierge",
  tracking_token: "tracking-token",
  stripe_checkout_session_id: "cs_expected",
  stripe_session_id: "cs_expected",
  stripe_payment_intent_id: null,
  payment_intent_id: null,
  payment_link_token: "order-token",
  ops_status: "new",
});

function configureSupabase() {
  supabaseFrom.mockImplementation((table: string) => {
    if (table === "orders") {
      const builder: any = {
        select: vi.fn(() => builder),
        update: vi.fn((payload: Record<string, unknown>) => {
          builder.pendingUpdate = payload;
          return builder;
        }),
        eq: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        is: vi.fn(() => builder),
        single: vi.fn(async () => ({ data: orderState.current, error: null })),
        maybeSingle: vi.fn(async () => ({ data: orderState.current, error: null })),
        selectRows: vi.fn(),
        then: (resolve: (value: unknown) => unknown) => {
          const result = updateFailure.current
            ? { error: updateFailure.current }
            : { error: null };
          if (!updateFailure.current && orderState.current && builder.pendingUpdate) {
            Object.assign(orderState.current, builder.pendingUpdate);
          }
          return Promise.resolve(result).then(resolve);
        },
      };
      builder.select = vi.fn((columns?: string) => {
        if (builder.pendingUpdate) {
          const alreadyPaid = orderState.current?.payment_status === "paid";
          const statusMatches = !builder.expectedStatus ||
            orderState.current?.payment_status === builder.expectedStatus;
          return Promise.resolve({
            data: alreadyPaid || !statusMatches ? [] : (Object.assign(orderState.current!, builder.pendingUpdate), [{ id: "order-1" }]),
            error: updateFailure.current,
          });
        }
        return builder;
      });
      builder.eq = vi.fn((field: string, value: unknown) => {
        if (field === "payment_status") builder.expectedStatus = value;
        return builder;
      });
      return builder;
    }
    if (table === "profiles") {
      const builder: any = { select: vi.fn(() => builder), eq: vi.fn(() => builder), single: vi.fn(async () => ({ data: null, error: null })) };
      return builder;
    }
    if (table === "activity_log") return { insert: vi.fn(async () => ({ error: null })) };
    if (table === "ridecheck_credits") {
      const builder: any = { select: vi.fn(() => builder), eq: vi.fn(() => builder), maybeSingle: vi.fn(async () => ({ data: null, error: null })), insert: vi.fn(async () => ({ error: null })) };
      return builder;
    }
    throw new Error(`Unexpected Supabase table in test: ${table}`);
  });
}

async function postWebhook() {
  const { POST } = await import("../route");
  const req = new Request("https://test.local/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "valid-test-signature" },
    body: "{}",
  });
  return POST(req as any);
}

function checkoutEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_checkout",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_expected",
        mode: "payment",
        payment_status: "paid",
        amount_total: 29900,
        currency: "usd",
        payment_intent: "pi_test",
        metadata: { order_id: "order-1", payment_link_token: "order-token" },
        customer_details: { email: "buyer@example.com" },
        ...overrides,
      },
    },
  };
}

beforeEach(async () => {
  vi.resetModules();
  orderState.current = defaultOrder();
  configuredEvent.current = checkoutEvent();
  updateFailure.current = null;
  stripe.webhooks.constructEvent.mockImplementation(() => configuredEvent.current);
  stripe.checkout.sessions.create.mockClear();
  stripe.checkout.sessions.retrieve.mockClear();
  stripe.checkout.sessions.create.mockResolvedValue({
    id: "cs_expected",
    url: "https://checkout.stripe.test/session",
  });
  stripe.checkout.sessions.retrieve.mockResolvedValue({
    id: "cs_expected",
    status: "expired",
    payment_status: "unpaid",
    url: null,
  });
  notifyOps.mockReset().mockResolvedValue(undefined);
  sendEmail.mockReset().mockResolvedValue(undefined);
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  supabaseFrom.mockReset();
  configureSupabase();
});

describe("Stripe payment-first webhook safety", () => {
  it("activates only a signed, correctly linked USD payment for the exact order amount", async () => {
    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(orderState.current).toMatchObject({
      payment_status: "paid",
      ops_status: "contact_seller",
      stripe_checkout_session_id: "cs_expected",
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(notifyOps).toHaveBeenCalledTimes(1);
    expect(notifyOps.mock.calls[0][0]).toMatchObject({
      orderId: "order-1",
      subject: expect.stringContaining("Payment successful"),
      body: expect.stringContaining("Amount actually paid: $299.00 USD"),
    });
  });

  it.each([
    ["short amount", { amount_total: 29899, currency: "usd" }],
    ["wrong currency", { amount_total: 29900, currency: "cad" }],
    ["other checkout session", { id: "cs_other" }],
  ])("does not activate a %s", async (_caseName, overrides) => {
    configuredEvent.current = checkoutEvent(overrides);
    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(orderState.current?.payment_status).toBe("pending");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(notifyOps).not.toHaveBeenCalled();
  });

  it("includes actual Stripe Tax cents when validating a tax-enabled Checkout payment", async () => {
    configuredEvent.current = checkoutEvent({
      amount_total: 31983,
      automatic_tax: { enabled: true },
      total_details: { amount_tax: 2083 },
    });
    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(orderState.current?.payment_status).toBe("paid");
    expect(notifyOps.mock.calls[0][0].body).toContain("Amount actually paid: $319.83 USD");
  });

  it("does not activate from an incomplete Checkout session or browser redirect", async () => {
    configuredEvent.current = checkoutEvent({ payment_status: "unpaid" });
    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(orderState.current?.payment_status).toBe("pending");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects invalid webhook signatures before any database mutation", async () => {
    stripe.webhooks.constructEvent.mockImplementationOnce(() => { throw new Error("bad signature"); });
    const response = await postWebhook();
    expect(response.status).toBe(400);
    expect(orderState.current?.payment_status).toBe("pending");
    expect(notifyOps).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("marks an expired Checkout attempt failed without changing operational status", async () => {
    configuredEvent.current = {
      id: "evt_expired",
      type: "checkout.session.expired",
      data: { object: {
        id: "cs_expected",
        metadata: { order_id: "order-1" },
      } },
    };
    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(orderState.current).toMatchObject({ payment_status: "failed", ops_status: "new" });
    expect(notifyOps).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("records payment failure only, never activating the order", async () => {
    configuredEvent.current = {
      id: "evt_failed",
      type: "payment_intent.payment_failed",
      data: { object: {
        id: "pi_test",
        metadata: { order_id: "order-1", payment_link_token: "order-token" },
        last_payment_error: { message: "declined" },
      } },
    };
    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(orderState.current).toMatchObject({ payment_status: "failed", ops_status: "new" });
    expect(notifyOps).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("waits for the linked Checkout when a token-linked PaymentIntent arrives first", async () => {
    configuredEvent.current = {
      id: "evt_pi",
      type: "payment_intent.succeeded",
      data: { object: {
        id: "pi_test",
        status: "succeeded",
        amount: 29900,
        amount_received: 29900,
        currency: "usd",
        receipt_email: "buyer@example.com",
        metadata: { order_id: "order-1", payment_link_token: "order-token" },
      } },
    };
    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(orderState.current?.payment_status).toBe("pending");
    expect(notifyOps).not.toHaveBeenCalled();
    configuredEvent.current = checkoutEvent();
    const checkoutResponse = await postWebhook();
    expect(checkoutResponse.status).toBe(200);
    expect(orderState.current?.payment_status).toBe("paid");
    expect(notifyOps).toHaveBeenCalledTimes(1);
  });

  it("rejects an unlinked or wrong-amount PaymentIntent", async () => {
    configuredEvent.current = {
      id: "evt_pi",
      type: "payment_intent.succeeded",
      data: { object: {
        id: "pi_other",
        status: "succeeded",
        amount: 29800,
        amount_received: 29800,
        currency: "usd",
        metadata: { order_id: "order-1", payment_link_token: "wrong-token" },
      } },
    };
    const response = await postWebhook();
    expect(response.status).toBe(409);
    expect(orderState.current?.payment_status).toBe("pending");
    expect(notifyOps).not.toHaveBeenCalled();
  });

  it("is status-idempotent under replay and sends only one customer and Ops confirmation", async () => {
    await postWebhook();
    await postWebhook();
    expect(orderState.current?.payment_status).toBe("paid");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(notifyOps).toHaveBeenCalledTimes(1);
  });

  it("does not roll back paid state if Ops notification rejects", async () => {
    notifyOps.mockRejectedValueOnce(new Error("provider unavailable"));
    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(orderState.current?.payment_status).toBe("paid");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("Checkout session creation linkage", () => {
  it("puts server-derived order/token linkage on both Checkout and PaymentIntent metadata", async () => {
    orderState.current!.stripe_checkout_session_id = null;
    orderState.current!.stripe_session_id = null;
    const { POST } = await import("@/app/api/pay/create-session/route");
    const req = new Request("https://test.local/api/pay/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", token: "order-token", payment_status: "paid" }),
    });
    const response = await POST(req as any);
    expect(response.status).toBe(200);
    const args = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.line_items[0].price_data.unit_amount).toBe(29900);
    expect(args.payment_intent_data.metadata).toMatchObject({
      order_id: "order-1",
      payment_link_token: "order-token",
    });
    expect(args.metadata).toMatchObject({
      order_id: "order-1",
      payment_link_token: "order-token",
    });
    expect(stripe.checkout.sessions.create.mock.calls[0][1].idempotencyKey).toContain("order-1:order-token");
  });

  it("reuses an open linked session instead of creating another charge opportunity", async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValueOnce({
      id: "cs_expected",
      status: "open",
      url: "https://checkout.stripe.test/existing",
    });
    const { POST } = await import("@/app/api/pay/create-session/route");
    const req = new Request("https://test.local/api/pay/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", token: "order-token" }),
    });
    const response = await POST(req as any);
    expect(response.status).toBe(200);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});