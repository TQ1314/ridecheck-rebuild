import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/rbac";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { currentIntakeSession, createIntakeSession, verifyIntakeSession, setIntakeCookie } from "@/lib/booking-intake/session";
import { facebookContactEventSchema, isFacebookMarketplaceListing, FACEBOOK_SOURCE, FACEBOOK_INITIAL_CONTACT_REASON } from "@/lib/seller-contact/facebook-marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  listing_url: z.string().url().max(2000).nullable(),
  platform_source: z.literal(FACEBOOK_SOURCE),
  events: z.array(facebookContactEventSchema).min(1).max(3),
}).strict();

// A bounded, best-effort per-instance throttle; this is not an authorization gate.
const attempts = new Map<string, { count: number; expires: number }>();

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
    const text = await req.text();
    if (text.length > 4096) return NextResponse.json({ error: "Event too large" }, { status: 413 });
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success || !isFacebookMarketplaceListing(parsed.data.listing_url, parsed.data.platform_source)) {
      return NextResponse.json({ error: "Invalid Marketplace event" }, { status: 400 });
    }
    const now = Date.now();
    for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = attempts.get(ip);
    if (limit && limit.count >= 40) return NextResponse.json({ error: "Please try again shortly" }, { status: 429 });
    if (attempts.size >= 2000 && !limit) return NextResponse.json({ error: "Please try again shortly" }, { status: 429 });
    attempts.set(ip, { count: (limit?.count ?? 0) + 1, expires: limit?.expires ?? now + 60_000 });

    const existingSession = currentIntakeSession();
    const newCookie = existingSession ? null : createIntakeSession();
    const sessionId = existingSession ?? verifyIntakeSession(newCookie!);
    const { data: { session } } = await createRouteHandlerSupabaseClient().auth.getSession();
    for (const event of new Set(parsed.data.events)) {
      await writeAuditLog({
        actorId: session?.user?.id ?? null,
        actorEmail: session?.user?.email ?? "",
        actorRole: session ? "buyer" : "guest",
        action: event,
        resourceId: sessionId!,
        metadata: {
          source: FACEBOOK_SOURCE,
          listing_url: parsed.data.listing_url,
          concierge_unavailable_reason: FACEBOOK_INITIAL_CONTACT_REASON,
          evidence_type: "buyer_reported",
          independently_confirmed: false,
          intake_session_id: sessionId,
          timestamp: new Date().toISOString(),
        },
        throwOnError: true,
      });
    }
    const response = NextResponse.json({ success: true });
    if (newCookie) setIntakeCookie(response, newCookie);
    return response;
  } catch (error) {
    console.error("[Facebook contact audit]", error);
    return NextResponse.json({ error: "Unable to save contact event. Your booking can still retain these details." }, { status: 503 });
  }
}