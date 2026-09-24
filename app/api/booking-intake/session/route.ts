import { NextResponse } from "next/server";
import { currentIntakeSession, createIntakeSession, setIntakeCookie } from "@/lib/booking-intake/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessionId = currentIntakeSession();
    if (!sessionId) return NextResponse.json({ imageCount: 0 });
    const { data, error } = await supabaseAdmin.storage.from("booking-intake").list(sessionId, { limit: 6 });
    if (error) throw error;
    return NextResponse.json({ imageCount: data?.length ?? 0 });
  } catch (error) {
    console.error("[booking-intake session status]", error);
    return NextResponse.json({ error: "Unable to check previous uploads." }, { status: 503 });
  }
}

export async function POST() {
  try {
    const response = NextResponse.json({ imageCount: 0 });
    setIntakeCookie(response, createIntakeSession());
    return response;
  } catch (error) {
    console.error("[booking-intake session reset]", error);
    return NextResponse.json({ error: "Unable to start a new vehicle intake." }, { status: 503 });
  }
}