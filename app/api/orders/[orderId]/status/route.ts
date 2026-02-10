import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canUpdateStatus, type Role } from "@/lib/utils/roles";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum([
    "submitted",
    "payment_requested",
    "payment_received",
    "seller_contacted",
    "seller_confirmed",
    "inspection_scheduled",
    "inspection_in_progress",
    "report_drafting",
    "report_ready",
    "completed",
    "cancelled",
  ]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (!profile || !canUpdateStatus(profile.role as Role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq("id", params.orderId);

    if (error) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await supabaseAdmin.from("activity_log").insert({
      user_id: session.user.id,
      order_id: params.orderId,
      action: "status_changed",
      details: { new_status: parsed.data.status },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
