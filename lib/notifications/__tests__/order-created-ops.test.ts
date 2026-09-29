import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, sendEmail } = vi.hoisted(() => ({
  from: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from } }));
vi.mock("../email", () => ({ sendEmail }));

import { notifyNewOrderRequest } from "../order-created-ops";

const order = {
  id: "request-example",
  created_at: "2026-09-29T00:00:00Z",
  buyer_email: "buyer@example.test",
  buyer_phone: "555-0100",
  vehicle_year: 2023,
  vehicle_make: "Rivian",
  vehicle_model: "R1S",
  package: "exotic",
  final_price: 299,
  booking_type: "concierge",
  seller_name: "Dealer",
  seller_phone: "555-0101",
};

describe("order-created Ops alert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({
      select: () => ({
        in: () => ({ eq: async () => ({ data: [{ email: "ops@example.test" }], error: null }) }),
      }),
    });
    sendEmail.mockResolvedValue({ success: true });
  });

  it("marks an unpaid Concierge request non-actionable and includes its details", async () => {
    await notifyNewOrderRequest(order);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "ops@example.test",
      subject: expect.stringContaining("PENDING PAYMENT"),
      html: expect.stringContaining("no seller outreach or dispatch"),
    }));
    expect(sendEmail.mock.calls[0][0].html).toContain("Amount requested: $299.00");
    expect(sendEmail.mock.calls[0][0].html).toContain("Seller/dealer: Dealer");
  });

  it("logs a provider rejection without throwing", async () => {
    sendEmail.mockResolvedValue({ success: false });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyNewOrderRequest(order)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      "[order created ops] notification failed",
      expect.objectContaining({ orderId: order.id }),
    );
    log.mockRestore();
  });
});