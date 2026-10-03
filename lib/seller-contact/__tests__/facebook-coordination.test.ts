import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  events: [] as { event_type: string; details?: Record<string, unknown> }[],
  write: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/rbac", () => ({ writeOrderEvent: mocks.write }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: () => {
    const builder = { select: () => builder, eq: () => builder,
      in: async () => ({ data: mocks.events, error: null }) };
    return builder;
  } },
}));
import { recordFacebookCoordinationStarted } from "../facebook-coordination.server";
beforeEach(() => { mocks.events = []; vi.clearAllMocks(); });
describe("existing paid Ops workflow Facebook event hook", () => {
  it("records coordination only for a new buyer-reported Marketplace handoff", async () => {
    mocks.events = [{ event_type: "seller_consent_reported", details: { source: "facebook_marketplace" } }];
    await recordFacebookCoordinationStarted("order-id", "ops-id", "ops@example.test");
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "seller_coordination_started", orderId: "order-id", actorId: "ops-id",
      details: expect.objectContaining({ source: "facebook_marketplace", payment_gate_passed: true }),
    }));
    expect(JSON.stringify(mocks.write.mock.calls)).not.toContain("inspection_completed");
  });
  it("leaves historical orders without this handoff untouched", async () => {
    await recordFacebookCoordinationStarted("historical-order", "ops-id", "ops@example.test");
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("does not interpret a different consent source as a Marketplace handoff", async () => {
    mocks.events = [{ event_type: "seller_consent_reported", details: { source: "craigslist" } }];
    await recordFacebookCoordinationStarted("order-id", "ops-id", "ops@example.test");
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("does not repeatedly emit coordination-start on subsequent actions", async () => {
    mocks.events = [{ event_type: "seller_consent_reported", details: { source: "facebook_marketplace" } },
      { event_type: "seller_coordination_started" }];
    await recordFacebookCoordinationStarted("order-id", "ops-id", "ops@example.test");
    expect(mocks.write).not.toHaveBeenCalled();
  });
});