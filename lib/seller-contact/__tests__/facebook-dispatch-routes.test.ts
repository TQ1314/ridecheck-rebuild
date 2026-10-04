import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  order: {} as any, writes: vi.fn(), from: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/rbac", () => ({
  requireRole: async () => ({ actor: { userId: "ops", role: "admin", email: "ops@example.test" } }),
  isAuthorized: () => true, writeAuditLog: vi.fn(), writeOrderEvent: vi.fn(),
}));
vi.mock("@/lib/ridecheckers/eligibility", () => ({
  getRideCheckerAssignmentEligibility: () => ({ eligible: true, blockedReasons: [] }),
}));
vi.mock("@/lib/notifications/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/notifications/sms", () => ({ sendSMS: vi.fn() }));

import { PATCH as assign } from "@/app/api/ops/orders/[orderId]/ridechecker-assign/route";
import { POST as broadcast } from "@/app/api/ops/orders/[orderId]/broadcast/route";
import { PATCH as legacyAssign } from "@/app/api/orders/[orderId]/assign/route";

const rcId = "00000000-0000-4000-8000-000000000001";
const complete = {
  id: "order-1", booking_type: "self_arrange", platform_source: "facebook_marketplace",
  listing_url: "https://facebook.com/marketplace/item/123",
  payment_status: "paid", payment_required: true, payment_override_approved: false,
  seller_contact_status: "confirmed", seller_available_date: "2026-10-05",
  seller_available_time: "14:00", seller_inspection_address: "123 Vehicle Street",
};
const paths = [
  ["assign", assign, { ridechecker_id: rcId }, "PATCH"],
  ["broadcast", broadcast, { ridechecker_ids: [rcId], offered_pay: 100 }, "POST"],
  ["legacy inspector assign", legacyAssign, { inspector_id: rcId }, "PATCH"],
] as const;
const context = { params: { orderId: "order-1" } };
function request(body: object, method: string) {
  return new NextRequest("https://example.test/api/ops/orders/order-1/action", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.order = { ...complete };
  mocks.from.mockImplementation((table: string) => {
    const data = () => table === "orders" ? mocks.order
      : table === "profiles" ? { id: rcId, role: "ridechecker_active", full_name: "RC" }
      : table === "rc_compensation_offers" ? { total_offer: 100 }
      : { id: "assignment-1" };
    const builder: any = {};
    for (const method of ["select", "eq", "in", "is", "limit", "order", "neq"]) {
      builder[method] = vi.fn(() => builder);
    }
    for (const method of ["insert", "update"]) {
      builder[method] = vi.fn((payload) => { mocks.writes(table, method, payload); return builder; });
    }
    builder.single = builder.maybeSingle = async () => ({ data: data(), error: null });
    builder.then = (resolve: any, reject: any) => Promise.resolve({
      data: table === "profiles" ? [data()] : [data()], error: null,
    }).then(resolve, reject);
    return builder;
  });
});

describe.each(paths)("%s Facebook appointment safety", (_name, action, body, method) => {
  it("rejects unpaid before any write", async () => {
    mocks.order.payment_status = "unpaid";
    const response = await action(request(body, method), context);
    expect(response.status).toBe(402);
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it.each([
    ["seller_contact_status", "seller contact confirmation"],
    ["seller_available_date", "confirmed inspection date"],
    ["seller_available_time", "confirmed inspection time"],
    ["seller_inspection_address", "vehicle/inspection address"],
  ])("rejects absent and blank %s without dispatch writes", async (field, label) => {
    for (const value of [undefined, null, "", "   ", "\n\t"]) {
      mocks.order = { ...complete, [field]: value };
      const response = await action(request(body, method), context);
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe(`Appointment not confirmed — missing ${label}.`);
      expect(mocks.writes).not.toHaveBeenCalled();
    }
  });
  it("rejects payment plus requested date plus reported seller consent", async () => {
    mocks.order = { ...complete, seller_contact_status: "accepted", preferred_date: "2026-10-05",
      seller_consent_reported: true };
    expect((await action(request(body, method), context)).status).toBe(409);
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it("does not let an authorized radius override bypass the appointment gate", async () => {
    mocks.order.seller_available_time = " ";
    const response = await action(request({ ...body, override: true, override_reason: "Approved radius exception" }, method), context);
    expect(response.status).toBe(409);
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it("allows a paid order with a fully confirmed appointment", async () => {
    expect((await action(request(body, method), context)).status).toBe(200);
    expect(mocks.writes).toHaveBeenCalled();
  });
  it.each([
    { payment_status: "unpaid", payment_required: false },
    { payment_status: "override_approved", payment_override_approved: true },
  ])("preserves existing payment eligibility, still requiring appointment", async (payment) => {
    mocks.order = { ...complete, ...payment, seller_available_time: "" };
    expect((await action(request(body, method), context)).status).toBe(409);
    mocks.order.seller_available_time = "14:00";
    expect((await action(request(body, method), context)).status).toBe(200);
  });
  it.each(["craigslist", "dealership", "roadside", "auction"])("leaves %s paid dispatch unchanged", async (source) => {
    mocks.order = { ...complete, listing_url: null, platform_source: source,
      seller_contact_status: null, seller_available_date: null, seller_available_time: null,
      seller_inspection_address: null };
    expect((await action(request(body, method), context)).status).toBe(200);
  });
  it("does not retroactively gate or rewrite historical Facebook Concierge", async () => {
    mocks.order = { ...complete, booking_type: "concierge", seller_contact_status: null,
      seller_available_date: null, seller_available_time: null, seller_inspection_address: null };
    expect((await action(request(body, method), context)).status).toBe(200);
    for (const [table, , payload] of mocks.writes.mock.calls) {
      if (table === "orders") expect(payload).not.toHaveProperty("booking_type");
    }
  });
});

it("preserves unassignment even when Facebook appointment and payment are incomplete", async () => {
  mocks.order = { ...complete, payment_status: "unpaid", seller_contact_status: null };
  expect((await assign(request({ ridechecker_id: null }, "PATCH"), context)).status).toBe(200);
});