import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, writeAuditLog, writeOrderEvent, from, update } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  writeAuditLog: vi.fn(),
  writeOrderEvent: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/rbac", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireRole,
    isAuthorized: (result: any) => !!result.actor,
    writeAuditLog,
    writeOrderEvent,
  };
});
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from } }));

import { POST } from "../route";

const request = () => new Request("https://example.test/api/admin/orders/example/payment-override", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ reason: "Approved field test", confirmed: true }),
});

describe("authorized payment override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      actor: { role: "operations_lead", userId: "lead", email: "lead@example.test" },
    });
    from.mockReturnValue({
      select: () => ({ eq: () => ({ single: async () => ({
        data: { id: "example", payment_status: "unpaid", payment_override_approved: false },
        error: null,
      }) }) }),
      update: (value: unknown) => {
        update(value);
        return { eq: async () => ({ error: null }) };
      },
    });
    writeAuditLog.mockResolvedValue(undefined);
    writeOrderEvent.mockResolvedValue(undefined);
  });

  it("allows an Ops Lead with confirmation and records the reason", async () => {
    const response = await POST(request() as any, { params: { orderId: "example" } });
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      payment_status: "override_approved",
      payment_override_approved: true,
      payment_override_reason: "Approved field test",
      payment_override_by: "lead",
    }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "order.payment_override_approved",
      resourceId: "example",
    }));
  });

  it("rejects unauthorized callers without touching the order", async () => {
    const { NextResponse } = await import("next/server");
    requireRole.mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await POST(request() as any, { params: { orderId: "example" } });
    expect(response.status).toBe(403);
    expect(from).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});