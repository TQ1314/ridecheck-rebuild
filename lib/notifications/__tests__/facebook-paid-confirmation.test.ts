import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  order: {} as any, error: null as any, capture: vi.fn(),
}));
vi.mock("resend", () => ({ Resend: class {} }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: () => {
    const builder: any = {
      select: () => builder, eq: () => builder,
      maybeSingle: async () => ({ data: mocks.order, error: mocks.error }),
    };
    return builder;
  } },
}));
vi.mock("../staging-capture", () => ({
  stagingCaptureEnabled: () => true, captureStagingNotification: mocks.capture,
}));
import { sendEmail } from "../email";

const original = "<p>Your RideCheck assessment has been confirmed and is now in our queue.</p>";
const message = {
  to: "buyer@example.test", subject: "Payment Confirmed", html: original,
  template: "buyer-paid-confirmation", orderId: "order-1",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.error = null;
  mocks.order = { booking_type: "self_arrange", preferred_date: "2026-10-05",
    listing_url: "https://facebook.com/marketplace/item/123", platform_source: "facebook_marketplace" };
});
describe("existing post-payment confirmation without Stripe changes", () => {
  it("adds the Facebook proposal, requested date, original link and reply instructions", async () => {
    expect((await sendEmail(message)).success).toBe(true);
    const html = mocks.capture.mock.calls[0][0].content;
    expect(html).toContain("2026-10-05");
    expect(html).toContain(mocks.order.listing_url);
    expect(html).toContain("Once the seller confirms, reply to this message with the confirmed date, time, and vehicle address.");
    expect(html).toContain("Your payment is confirmed. Your inspection appointment is not confirmed");
    expect(html).not.toContain("Your RideCheck assessment has been confirmed");
  });
  it.each(["concierge", "non-facebook"])("preserves %s paid confirmation content exactly", async (kind) => {
    if (kind === "concierge") mocks.order.booking_type = "concierge";
    else { mocks.order.listing_url = null; mocks.order.platform_source = "craigslist"; }
    await sendEmail(message);
    expect(mocks.capture.mock.calls[0][0].content).toBe(original);
  });
  it("does not alter unrelated notification templates", async () => {
    mocks.error = new Error("Lookup must not be used");
    expect((await sendEmail({ ...message, template: "other" })).success).toBe(true);
    expect(mocks.capture.mock.calls[0][0].content).toBe(original);
  });
  it("sends the standard confirmation and logs context failure for Ops", async () => {
    mocks.error = new Error("Test context unavailable");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await sendEmail(message)).success).toBe(true);
      expect(mocks.capture.mock.calls[0][0].content).toBe(original);
      expect(log).toHaveBeenCalledWith(
        "[Paid confirmation enrichment failed; sending standard confirmation]",
        { orderId: "order-1", template: "buyer-paid-confirmation", reason: "Test context unavailable" },
      );
    } finally { log.mockRestore(); }
  });
  it("also sends the standard confirmation if the order-context row is missing", async () => {
    mocks.order = null;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await sendEmail(message)).success).toBe(true);
      expect(mocks.capture.mock.calls[0][0].content).toBe(original);
      expect(log).toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it("sends the standard confirmation if Facebook enrichment itself throws", async () => {
    mocks.order.preferred_date = {};
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await sendEmail(message)).success).toBe(true);
      expect(mocks.capture.mock.calls[0][0].content).toBe(original);
      expect(log).toHaveBeenCalledWith(
        "[Paid confirmation enrichment failed; sending standard confirmation]",
        expect.objectContaining({ orderId: "order-1", reason: expect.any(String) }),
      );
    } finally { log.mockRestore(); }
  });
});