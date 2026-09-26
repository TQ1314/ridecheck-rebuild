import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: mocks.create };
  },
}));
vi.mock("@/lib/supabase/route-handler", () => ({
  createRouteHandlerSupabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: "inspector" } } } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { role: "ridechecker_active" } }) }),
      }),
    }),
  },
}));

import { POST } from "../route";

const request = (fileName: string, fileType: string) => new NextRequest(
  "http://localhost/api/ridechecker/obd/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_url: "https://example.test/original",
      file_name: fileName,
      file_type: fileType,
    }),
  },
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("OBD extraction methods", () => {
  it.each([
    ["scan.txt", "text/plain"],
    ["scan.csv", "text/csv"],
  ])("direct-parses %s without Claude", async (name, mime) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, text: async () => "Autel\nP0420 Active catalyst\nP0300 Pending misfire",
    }));
    const response = await POST(request(name, mime));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.method).toBe("text_parse");
    expect(body.scanner_brand).toBe("Autel");
    expect(body.codes.map((code: { code: string }) => code.code)).toEqual(["P0420", "P0300"]);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    ["scan.pdf", "application/pdf", "claude_pdf"],
    ["scan.png", "image/png", "claude_vision"],
  ])("extracts %s with AI and reports confidence", async (name, mime, method) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }));
    mocks.create.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({
      codes: [{ system: "Powertrain", code: "P0420", status: "Active", description: "Catalyst" }],
      scanner_brand: "Autel", scanner_model: "MX808", confidence_score: 88, ocr_quality: "Clear",
    }) }] });
    const response = await POST(request(name, mime));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      method, scanner_brand: "Autel", scanner_model: "MX808",
      confidence_score: 88, codes: [{ code: "P0420" }],
    });
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("holds low-confidence image codes out of normal candidates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }));
    mocks.create.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({
      codes: [{ system: "Powertrain", code: "P0420", status: "Active" }],
      confidence_score: 42, ocr_quality: "Poor",
    }) }] });
    const body = await (await POST(request("blurry.jpg", "image/jpeg"))).json();
    expect(body.codes).toEqual([]);
    expect(body.low_confidence_codes).toEqual([expect.objectContaining({ code: "P0420" })]);
    expect(body.confidence_score).toBe(42);
  });
});