import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
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
      .select("role, full_name, phone")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const message = (body.message || "").trim();
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > 1000) {
      return NextResponse.json({ error: "Message too long (max 1000 chars)" }, { status: 400 });
    }

    const { data: assignment } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("id, order_id, status")
      .eq("id", params.assignmentId)
      .eq("ridechecker_id", session.user.id)
      .maybeSingle();

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("order_id, vehicle_year, vehicle_make, vehicle_model")
      .eq("id", assignment.order_id)
      .maybeSingle();

    const { error: insertError } = await supabaseAdmin
      .from("ridechecker_ops_messages")
      .insert({
        assignment_id: assignment.id,
        order_id: assignment.order_id,
        ridechecker_id: session.user.id,
        message,
        sent_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("[message-ops insert error]", insertError);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    const opsEmail =
      process.env.ADMIN_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      "ops@ridecheckauto.com";
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ridecheckauto.com";

    const vehicleLabel = order
      ? `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`
      : "Unknown Vehicle";
    const rcName = profile.full_name || session.user.email || "RideChecker";

    try {
      await resend.emails.send({
        from: `RideCheck Ops <${fromEmail}>`,
        to: opsEmail,
        subject: `[Field Message] ${rcName} — ${vehicleLabel}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a1a1a">RideChecker Field Message</h2>
            <p><strong>From:</strong> ${rcName} (${session.user.email})</p>
            <p><strong>Vehicle:</strong> ${vehicleLabel}</p>
            <p><strong>Assignment ID:</strong> ${assignment.id}</p>
            ${order ? `<p><strong>Order:</strong> ${order.order_id}</p>` : ""}
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
            <p style="font-size:16px;background:#f9f9f9;padding:16px;border-radius:8px;border-left:4px solid #2563eb">
              ${message}
            </p>
            <p style="color:#888;font-size:12px">Sent via RideChecker Portal — reply to this RideChecker directly via phone/text.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("[message-ops email error]", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[message-ops error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
