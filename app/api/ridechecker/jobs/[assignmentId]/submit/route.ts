import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { isChecklistComplete } from "@/lib/ridechecker/scoring";

const submitSchema = z.object({
  vin_photo_url: z.string().min(1),
  odometer_photo_url: z.string().min(1),
  under_hood_photo_url: z.string().min(1),
  undercarriage_photo_url: z.string().min(1),
  tire_tread_mm_front_left: z.number().optional(),
  tire_tread_mm_front_right: z.number().optional(),
  tire_tread_mm_rear_left: z.number().optional(),
  tire_tread_mm_rear_right: z.number().optional(),
  brake_condition: z.enum(["good", "fair", "poor", "unknown"]).optional(),
  scan_codes: z.array(z.string()).optional(),
  cosmetic_exterior: z.string().min(1),
  interior_condition: z.string().min(1),
  mechanical_issues: z.string().min(1),
  test_drive_notes: z.string().min(1),
  immediate_concerns: z.string().min(1),
  audio_note_url: z.string().optional(),
  extra_photos: z.array(z.string()).optional(),
});

export const dynamic = "force-dynamic";

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
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: assignment, error: fetchError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("id, status, order_id")
      .eq("id", params.assignmentId)
      .eq("ridechecker_id", session.user.id)
      .maybeSingle();

    if (fetchError || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (assignment.status !== "in_progress") {
      return NextResponse.json(
        { error: "Assignment is not in 'in_progress' status" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const now = new Date().toISOString();
    const checklist_complete = isChecklistComplete(data);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("ridechecker_raw_submissions")
      .insert({
        assignment_id: assignment.id,
        order_id: assignment.order_id,
        ridechecker_id: session.user.id,
        checklist_complete,
        vin_photo_url: data.vin_photo_url,
        odometer_photo_url: data.odometer_photo_url,
        under_hood_photo_url: data.under_hood_photo_url,
        undercarriage_photo_url: data.undercarriage_photo_url,
        tire_tread_mm_front_left: data.tire_tread_mm_front_left ?? null,
        tire_tread_mm_front_right: data.tire_tread_mm_front_right ?? null,
        tire_tread_mm_rear_left: data.tire_tread_mm_rear_left ?? null,
        tire_tread_mm_rear_right: data.tire_tread_mm_rear_right ?? null,
        brake_condition: data.brake_condition ?? null,
        scan_codes: data.scan_codes ?? null,
        cosmetic_exterior: data.cosmetic_exterior,
        interior_condition: data.interior_condition,
        mechanical_issues: data.mechanical_issues,
        test_drive_notes: data.test_drive_notes,
        immediate_concerns: data.immediate_concerns,
        audio_note_url: data.audio_note_url ?? null,
        extra_photos: data.extra_photos ?? null,
        submitted_at: now,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("[submit assignment insert error]", insertError);
      return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .update({
        status: "submitted",
        submitted_at: now,
      })
      .eq("id", assignment.id);

    if (updateError) {
      console.error("[submit assignment update error]", updateError);
      return NextResponse.json({ error: "Failed to update assignment status" }, { status: 500 });
    }

    return NextResponse.json({ success: true, submission_id: inserted.id });
  } catch (err: any) {
    console.error("[submit assignment error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
