import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
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
      .maybeSingle();

    if (
      !profile ||
      !["ridechecker_active", "owner"].includes(profile.role)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: assignment, error: assignErr } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select(
        "id, order_id, status, scheduled_start, scheduled_end, accepted_at, started_at, submitted_at, payout_amount, created_at"
      )
      .eq("id", params.assignmentId)
      .eq("ridechecker_id", session.user.id)
      .maybeSingle();

    if (assignErr || !assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_id, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, vehicle_location, inspection_address, scheduled_date, scheduled_time, package, booking_type, seller_name, special_instructions, created_at"
      )
      .eq("id", assignment.order_id)
      .maybeSingle();

    return NextResponse.json({
      assignment,
      order: order
        ? {
            id: order.id,
            order_id: order.order_id,
            vehicle_year: order.vehicle_year,
            vehicle_make: order.vehicle_make,
            vehicle_model: order.vehicle_model,
            vehicle_trim: order.vehicle_trim,
            vehicle_location: order.vehicle_location,
            inspection_address: order.inspection_address,
            scheduled_date: order.scheduled_date,
            scheduled_time: order.scheduled_time,
            package: order.package,
            booking_type: order.booking_type,
            seller_name: order.seller_name || null,
            special_instructions: order.special_instructions || null,
          }
        : null,
    });
  } catch (err: any) {
    console.error("[assignment detail error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
