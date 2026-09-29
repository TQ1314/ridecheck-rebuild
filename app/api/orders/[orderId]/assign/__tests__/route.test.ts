import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, writeAuditLog, writeOrderEvent, orderState, updated, from } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  writeAuditLog: vi.fn(),
  writeOrderEvent: vi.fn(),
  orderState: { current: null as any },
  updated: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requireRole,
  isAuthorized: (result: any) => !!result.actor,
  writeAuditLog,
  writeOrderEvent,
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from } }));

import { PATCH } from "../route";

const inspectorId = "00000000-0000-4000-8000-000000000001";

function makeRequest() {
  return new Request("https://example.test/api/orders/order-1/assign", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inspector_id: inspectorId }),
  });
}

describe("legacy order inspector assignment payment gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      actor: { userId: "ops-1", role: "operations_lead", email: "ops@example.test" },
    });
    orderState.current = {
      payment_status: "unpaid",
      payment_required: true,
      payment_override_approved: false,
    };
    from.mockImplementation((table: string) => {
      if (table === "activity_log") return { insert: vi.fn(async () => ({ error: null })) };
      const builder: any = {
        select: vi.fn(() => builder),
        update: vi.fn((payload: unknown) => { updated(payload); return builder; }),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({ data: orderState.current, error: null })),
        then: (resolve: (value: unknown) => unknown) => resolve({
          data: [{ id: "order-1" }],
          error: null,
        }),
      };
      return builder;
    });
  });

  it("rejects an unpaid inspector assignment without updating the order", async () => {
    const response = await PATCH(makeRequest() as any, { params: { orderId: "order-1" } });
    expect(response.status).toBe(402);
    expect(updated).not.toHaveBeenCalled();
  });

  it.each([
    ["Stripe-paid", { payment_status: "paid", payment_required: true, payment_override_approved: false }],
    ["payment-required=false", { payment_status: "unpaid", payment_required: false, payment_override_approved: false }],
    ["authorized override", { payment_status: "override_approved", payment_required: true, payment_override_approved: true }],
  ])("allows %s inspector assignment", async (_label, allowedState) => {
    orderState.current = allowedState;
    const response = await PATCH(makeRequest() as any, { params: { orderId: "order-1" } });
    expect(response.status).toBe(200);
    expect(updated).toHaveBeenCalledWith(expect.objectContaining({ assigned_inspector_id: inspectorId }));
  });
});