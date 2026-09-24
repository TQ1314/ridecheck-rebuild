import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  messagesCreate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: mocks.messagesCreate };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { storage: { from: () => ({ download: mocks.download }) } },
}));
vi.mock("@/lib/booking-intake/session", () => ({
  currentIntakeSession: () => "11111111-1111-4111-8111-111111111111",
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true }),
  getClientKey: () => "test",
}));

import { POST } from "../route";

const imageId = "22222222-2222-4222-8222-222222222222";
const request = () => new NextRequest("http://localhost/api/booking-intake/extract", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ imageIds: [imageId] }),
});

describe("Universal Intake image extraction", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mocks.download.mockResolvedValue({
      data: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("sends an uploaded image with the current Haiku model and unchanged request shape", async () => {
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"make":"Toyota"}' }],
    });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fields.make.value).toBe("Toyota");
    expect(mocks.messagesCreate).toHaveBeenCalledOnce();
    expect(mocks.messagesCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      system: "You extract literal vehicle listing facts. Never infer missing values.",
      messages: [expect.objectContaining({
        role: "user",
        content: expect.arrayContaining([expect.objectContaining({ type: "image" })]),
      })],
    }));
  });

  it("returns empty fields and manual-entry guidance when the provider fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.messagesCreate.mockRejectedValue(new Error("provider unavailable"));

    const response = await POST(request());

    expect(mocks.messagesCreate).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      fields: {},
      warning: "Extraction is unavailable. You can continue with manual entry.",
    });
  });
});