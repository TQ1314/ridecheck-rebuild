import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  order: { payment_status: "unpaid", payment_required: true, payment_override_approved: false } as any,
  assignment: { id: "assignment-id", order_id: "order-id", ridechecker_id: "rc-id", status: "assigned" } as any,
  existingSession: null as any,
  insertSession: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requireRole: async () => ({ actor: { role: "ridechecker_active", userId: "rc-id" } }),
  isAuthorized: () => true,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const query: any = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => {
          if (table === "ridechecker_job_assignments") return { data: state.assignment, error: null };
          if (table === "orders") return { data: state.order, error: null };
          if (table === "ridecheck_inspection_sessions") return { data: state.existingSession, error: null };
          return { data: null, error: null };
        },
        insert: (value: unknown) => {
          state.insertSession(value);
          return query;
        },
        update: () => query,
        single: async () => ({ data: { id: "session-id", status: "in_progress" }, error: null }),
      };
      return query;
    },
  },
}));

import { POST } from "../route";

describe("inspection session payment gate", () => {
  beforeEach(() => {
    state.order = { payment_status: "unpaid", payment_required: true, payment_override_approved: false };
    state.assignment = { id: "assignment-id", order_id: "order-id", ridechecker_id: "rc-id", status: "assigned" };
    state.existingSession = null;
    state.insertSession.mockClear();
  });

  async function request() {
    return POST(new NextRequest("http://localhost/api/ridechecker/jobs/assignment-id/inspect/session", { method: "POST" }), {
      params: { assignmentId: "assignment-id" },
    });
  }

  it.each(["unpaid", "pending", "failed"])("blocks %s orders before creating an inspection session", async (payment_status) => {
    state.order.payment_status = payment_status;
    const response = await request();
    expect(response.status).toBe(402);
    expect(state.insertSession).not.toHaveBeenCalled();
  });

  it("allows payment verified by the existing authorized Ops override policy", async () => {
    state.order = { payment_status: "override_approved", payment_required: true, payment_override_approved: true };
    const response = await request();
    expect(response.status).toBe(200);
    expect(state.insertSession).toHaveBeenCalledOnce();
  });

  it("allows paid orders", async () => {
    state.order.payment_status = "paid";
    const response = await request();
    expect(response.status).toBe(200);
    expect(state.insertSession).toHaveBeenCalledOnce();
  });

  it("allows explicitly no-payment internal orders", async () => {
    state.order = { payment_status: "unpaid", payment_required: false, payment_override_approved: false };
    const response = await request();
    expect(response.status).toBe(200);
    expect(state.insertSession).toHaveBeenCalledOnce();
  });
});