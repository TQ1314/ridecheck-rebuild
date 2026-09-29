import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["inspector", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, JPEG, PNG, or WebP." },
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
      .select("id, order_id, inspector_status, report_status, payment_status, payment_required, payment_override_approved")
      .eq("order_id", params.orderId);

    if (actor.role !== "owner" && inspector) {
      query = query.eq("assigned_inspector_id", inspector.id);
    }

    const { data: order, error: fetchError } = await query.maybeSingle();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (!canProceedWithRideCheck(order)) {
      return NextResponse.json({ error: PAYMENT_GATE_ERRORS.inspection_start }, { status: 402 });
    }

    const ext = file.name.split(".").pop() || "pdf";
    const storagePath = `reports/${order.order_id}/${Date.now()}_report.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("reports")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file. Ensure 'reports' bucket exists in Supabase Storage." },
        { status: 500 }
      );
    }

    let updateQuery = supabaseAdmin
      .from("orders")
      .update({
        report_status: "uploaded",
        report_storage_path: storagePath,
        report_uploaded_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (order.payment_required === false) {
      updateQuery = updateQuery.eq("payment_required", false);
    } else if (order.payment_status === "override_approved" && order.payment_override_approved === true) {
      updateQuery = updateQuery.eq("payment_status", "override_approved").eq("payment_override_approved", true);
    } else {
      updateQuery = updateQuery.eq("payment_status", order.payment_status);
    }
    const { data: updatedRows, error: updateError } = await updateQuery.select("id");

    if (updateError) {
      console.error("Order update error:", updateError);
      return NextResponse.json({ error: "File uploaded but failed to update order" }, { status: 500 });
    }
    if (!updatedRows?.length) {
      return NextResponse.json({ error: "Payment status changed before report upload was saved; refresh and try again." }, { status: 409 });
    }

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      event_type: "report_uploaded",
      description: `Report uploaded by inspector (${file.name})`,
      performed_by: actor.userId,
      metadata: { file_name: file.name, file_size: file.size, storage_path: storagePath },
    });

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "report.uploaded",
      resourceId: order.order_id,
      newValue: { storage_path: storagePath, file_name: file.name },
    });

    return NextResponse.json({ success: true, storagePath });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
