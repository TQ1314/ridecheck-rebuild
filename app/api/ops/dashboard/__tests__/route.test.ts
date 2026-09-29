import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  requireRole: vi.fn(),
  isAuthorized: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {},
}));

import { computeNextAction } from "@/lib/payment/ops-next-action";

describe("Ops dashboard payment action labeling", () => {
  it("clearly marks unpaid requests as pending and not actionable", () => {
    expect(computeNextAction({
      id: "order-id",
      status: "submitted",
      assignment_status: "unassigned",
      payment_status: "unpaid",
      payment_required: true,
    })).toEqual({
      label: "PENDING PAYMENT — NOT ACTIONABLE",
      urgency: "low",
      link: "/operations/orders/order-id",
    });
  });

  it("keeps failed payments non-actionable and urgent", () => {
    expect(computeNextAction({
      id: "order-id",
      status: "submitted",
      assignment_status: "unassigned",
      payment_status: "failed",
      payment_required: true,
    }).label).toBe("Payment Failed — Not Actionable");
  });

  it("treats only the existing authorized override shape as actionable", () => {
    const base = {
      id: "order-id",
      status: "submitted",
      assignment_status: "unassigned",
      payment_required: true,
      payment_status: "override_approved",
    };
    expect(computeNextAction({ ...base, payment_override_approved: false }).label)
      .toBe("PENDING PAYMENT — NOT ACTIONABLE");
    expect(computeNextAction({ ...base, payment_override_approved: true }).label)
      .toBe("Assign RideChecker");
  });
});