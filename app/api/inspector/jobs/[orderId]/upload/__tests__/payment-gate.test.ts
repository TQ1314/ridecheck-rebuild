import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, writeAuditLog, from, upload } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  writeAuditLog: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/lib/rbac", () => ({
  requireRole,
  isAuthorized: (result: any) => !!result.actor,
  writeAuditLog,
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from,
    storage: { from: () => ({ upload }) },
  },
}));

import { POST } from "../route";

function makeRequest() {
  const form = new FormData();
  form.append("file", new File(["report"], "inspection.pdf", { type: "application/pdf" }));
  return new Request("https://example.test/api/inspector/jobs/RC-100/upload", {
    method: "POST",
    body: form,
  });
}

describe("legacy inspector report upload payment gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      actor: { userId: "inspector-1", role: "inspector", email: "inspector@example.test" },
    });
    from.mockImplementation((table: string) => {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data: table === "inspectors"
            ? { id: "inspector-profile" }
            : {
                id: "order-uuid",
                order_id: "RC-100",
                payment_status: "unpaid",
                payment_required: true,
                payment_override_approved: false,
              },
          error: null,
        }),
      };
      return builder;
    });
  });

  it("rejects an unpaid report upload before touching storage", async () => {
    const response = await POST(makeRequest() as any, { params: { orderId: "RC-100" } });
    expect(response.status).toBe(402);
    expect(upload).not.toHaveBeenCalled();
  });
});