import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getServiceAreaFromZip } from "@/lib/geo/resolveCounty";

const fixtures = vi.hoisted(() => ({
  cookie: "",
  files: new Map<string, string[]>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => fixtures.cookie ? { value: fixtures.cookie } : undefined }),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true }),
  getClientKey: () => "test",
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        list: async (sessionId: string) => ({
          data: (fixtures.files.get(sessionId) ?? []).map((name) => ({ name })),
          error: null,
        }),
        upload: async (path: string) => {
          const [sessionId, name] = path.split("/");
          fixtures.files.set(sessionId, [...(fixtures.files.get(sessionId) ?? []), name]);
          return { error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
  },
}));

import { createIntakeSession, verifyIntakeSession } from "@/lib/booking-intake/session";
import { GET, POST } from "../route";
import { POST as upload } from "../../upload/route";

function uploadRequest(cookie: string, count: number) {
  const form = new FormData();
  for (let index = 0; index < count; index++) {
    form.append("files", new File([
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
    ], `screenshot-${index}.png`, { type: "image/png" }));
  }
  return new NextRequest("http://localhost/api/booking-intake/upload", {
    method: "POST",
    headers: { Cookie: `ridecheck_intake=${cookie}` },
    body: form,
  });
}

describe("vehicle-specific intake sessions", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "test-only-session-secret-long-enough");
    fixtures.files.clear();
    fixtures.cookie = createIntakeSession();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("keeps Vehicle A on ordinary Back and rejects its unsupported ZIP", async () => {
    const id = verifyIntakeSession(fixtures.cookie)!;
    expect((await upload(uploadRequest(fixtures.cookie, 2))).status).toBe(200);
    expect(getServiceAreaFromZip("60056").isAllowed).toBe(false);
    // Moving between booking steps does not rotate the cookie or remove the files.
    expect(verifyIntakeSession(fixtures.cookie)).toBe(id);
    expect((await (await GET()).json()).imageCount).toBe(2);
  });

  it("rotates the signed session and gives Vehicle B a fresh quota without deleting A", async () => {
    const oldCookie = fixtures.cookie;
    const oldId = verifyIntakeSession(oldCookie)!;
    expect((await upload(uploadRequest(oldCookie, 5))).status).toBe(200);
    expect((await upload(uploadRequest(oldCookie, 1))).status).toBe(400);
    expect((await (await GET()).json()).imageCount).toBe(5);

    const reset = await POST();
    expect(reset.status).toBe(200);
    const newCookie = reset.cookies.get("ridecheck_intake")?.value;
    expect(newCookie).toBeDefined();
    const newId = verifyIntakeSession(newCookie);
    expect(newId).not.toBeNull();
    expect(newId).not.toBe(oldId);
    fixtures.cookie = newCookie!;
    expect((await (await GET()).json()).imageCount).toBe(0);
    expect((await upload(uploadRequest(newCookie!, 1))).status).toBe(200);
    expect((await (await GET()).json()).imageCount).toBe(1);
    expect(fixtures.files.get(oldId)).toHaveLength(5);
    expect(fixtures.files.get(newId!)).toHaveLength(1);
  });
});