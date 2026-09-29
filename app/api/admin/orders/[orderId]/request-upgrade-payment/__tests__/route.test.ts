import { beforeEach, describe, expect, it, vi } from "vitest";

const { stripeCreate, requireRole, writeAuditLog, writeOrderEvent, from, updateOrder } = vi.hoisted(() => ({
  stripeCreate: vi.fn(),
  requireRole: vi.fn(),
  writeAuditLog: vi.fn(),
  writeOrderEvent: vi.fn(),
  from: vi.fn(),
  updateOrder: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = { sessions: { create: stripeCreate } };
  },
}));
vi.mock("@/lib/rbac", () => ({
  requireRole,
  isAuthorized: (result: any) => !!result.actor,
  writeAuditLog,
  writeOrderEvent,
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from } }));

import { POST } from "../route";

const existingOrder = {
  id: "order-paid",
  buyer_email: "buyer@example.test",
  customer_email: null,
  vehicle_year: 2023,
  vehicle_make: "Rivian",
  vehicle_model: "R1S",
  package: "exotic",
  payment_status: "paid",
};

function makeRequest(body: unknown) {
  return new Request("https://example.test/api/admin/orders/order-paid/request-upgrade-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("request package-upgrade payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      actor: { userId: "ops-lead", email: "ops@example.test", role: "operations_lead" },
    });
    from.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: existingOrder, error: null }) }) }),
          update: (payload: unknown) => {
            updateOrder(payload);
            return { eq: () => ({ eq: async () => ({ error: null }) }) };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    stripeCreate.mockResolvedValue({
      id: "cs_upgrade",
      url: "https://checkout.stripe.test/upgrade",
    });
    writeOrderEvent.mockResolvedValue(undefined);
    writeAuditLog.mockResolvedValue(undefined);
  });

  it("creates a top-up without changing the paid base-order state or linkage", async () => {
    const response = await POST(makeRequest({
      diff_cents: 5000,
      new_package: "premium",
    }) as any, { params: { orderId: existingOrder.id } });

    expect(response.status).toBe(200);
    expect(stripeCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [expect.objectContaining({
        price_data: expect.objectContaining({ unit_amount: 5000 }),
      })],
      metadata: expect.objectContaining({
        order_id: existingOrder.id,
        session_type: "package_upgrade",
        new_package: "premium",
      }),
    }));
    expect(updateOrder).not.toHaveBeenCalled();
    expect(writeOrderEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "upgrade_payment_requested",
      details: expect.objectContaining({
        diff_cents: 5000,
        session_id: "cs_upgrade",
        base_payment_status: "paid",
      }),
    }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "order.upgrade_payment_requested",
      newValue: expect.objectContaining({ session_id: "cs_upgrade" }),
    }));
  });

  it("rejects an unpaid base order before creating a top-up session", async () => {
    from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { ...existingOrder, payment_status: "unpaid" }, error: null }),
        }),
      }),
    }));
    const response = await POST(makeRequest({
      diff_cents: 5000,
      new_package: "premium",
    }) as any, { params: { orderId: existingOrder.id } });

    expect(response.status).toBe(400);
    expect(stripeCreate).not.toHaveBeenCalled();
    expect(updateOrder).not.toHaveBeenCalled();
    expect(writeOrderEvent).not.toHaveBeenCalled();
  });

  it("rejects malformed top-up amounts", async () => {
    const response = await POST(makeRequest({
      diff_cents: 1.5,
      new_package: "premium",
    }) as any, { params: { orderId: existingOrder.id } });
    expect(response.status).toBe(400);
    expect(stripeCreate).not.toHaveBeenCalled();
  });
});