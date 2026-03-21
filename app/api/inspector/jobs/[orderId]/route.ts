import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["inspector", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const { data: inspector } = await supabaseAdmin
      .from("inspectors")
      .select("id")
      .eq("user_id", actor.userId)
      .maybeSingle();

    const safeColumns = "id, order_id, vehicle_year, vehicle_make, vehicle_model, vehicle_vin, vehicle_description, listing_url, vehicle_location, inspection_address, package, booking_type, scheduled_date, scheduled_time, seller_name, seller_phone, inspector_status, inspector_notes, report_status, report_storage_path, report_uploaded_at, qa_status, qa_notes, ops_status, created_at";

    let query = supabaseAdmin
      .from("orders")
      .select(safeColumns)
      .eq("order_id", params.orderId);

    if (actor.role !== "owner" && inspector) {
      query = query.eq("assigned_inspector_id", inspector.id);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { data: events } = await supabaseAdmin
      .from("order_events")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      order,
      events: events || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const statusUpdateSchema = z.object({
  inspector_status: z.enum([
    "en_route",
    "on_site",
    "inspecting",
    "wrapping_up",
    "completed",
  ]),
  inspector_notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["inspector", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = statusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: inspector } = await supabaseAdmin
      .from("inspectors")
      .select("id")
      .eq("user_id", actor.userId)
      .maybeSingle();

    let query = supabaseAdmin
      .from("orders")
      .select("id, order_id, inspector_status")
      .eq("order_id", params.orderId);

    if (actor.role !== "owner" && inspector) {
      query = query.eq("assigned_inspector_id", inspector.id);
    }

    const { data: order, error: fetchError } = await query.maybeSingle();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const updates: Record<string, any> = {
      inspector_status: parsed.data.inspector_status,
    };

    if (parsed.data.inspector_notes !== undefined) {
      updates.inspector_notes = parsed.data.inspector_notes;
    }

    if (parsed.data.inspector_status === "completed") {
      updates.inspection_completed_at = new Date().toISOString();
      updates.report_status = "pending_upload";
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updates)
      .eq("id", order.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      event_type: "inspector_status_change",
      description: `Inspector status changed to ${parsed.data.inspector_status}`,
      performed_by: actor.userId,
      metadata: { previous: order.inspector_status, new: parsed.data.inspector_status },
    });

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "inspector.status_update",
      resourceId: order.order_id,
      oldValue: { inspector_status: order.inspector_status },
      newValue: updates,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
