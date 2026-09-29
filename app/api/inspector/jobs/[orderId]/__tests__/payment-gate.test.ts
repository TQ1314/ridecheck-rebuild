import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, writeAuditLog, orderState, updated, from } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  writeAuditLog: vi.fn(),
  orderState: { current: null as any },
  updated: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requireRole,
  isAuthorized: (result: any) => !!result.actor,
  writeAuditLog,
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from } }));

import { PATCH } from "../route";

function makeRequest() {
  return new Request("https://example.test/api/inspector/jobs/RC-100", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inspector_status: "inspecting" }),
  });
}

describe("legacy inspector status payment gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      actor: { userId: "inspector-1", role: "inspector", email: "inspector@example.test" },
    });
    orderState.current = {
      id: "order-uuid",
      order_id: "RC-100",
      inspector_status: "en_route",
      payment_status: "unpaid",
      payment_required: true,
      payment_override_approved: false,
    };
    from.mockImplementation((table: string) => {
      if (table === "inspectors") {
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: { id: "inspector-profile" }, error: null }),
        };
        return builder;
      }
      if (table === "order_events") return { insert: async () => ({ error: null }) };
      const builder: any = {
        select: () => builder,
        update: (payload: unknown) => { updated(payload); return builder; },
        eq: () => builder,
        maybeSingle: async () => ({ data: orderState.current, error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve({
          data: [{ id: orderState.current.id }],
          error: null,
        }),
      };
      return builder;
    });
  });

  it("rejects unpaid field-work status transitions without updating the order", async () => {
    const response = await PATCH(makeRequest() as any, { params: { orderId: "RC-100" } });
    expect(response.status).toBe(402);
    expect(updated).not.toHaveBeenCalled();
  });

  it.each([
    ["paid", { payment_status: "paid", payment_required: true, payment_override_approved: false }],
    ["payment-required=false", { payment_status: "unpaid", payment_required: false, payment_override_approved: false }],
    ["authorized override", { payment_status: "override_approved", payment_required: true, payment_override_approved: true }],
  ])("allows %s field work", async (_label, gate) => {
    orderState.current = {
      ...orderState.current,
      ...gate,
    };
    const response = await PATCH(makeRequest() as any, { params: { orderId: "RC-100" } });
    expect(response.status).toBe(200);
    expect(updated).toHaveBeenCalledWith(expect.objectContaining({ inspector_status: "inspecting" }));
  });
});