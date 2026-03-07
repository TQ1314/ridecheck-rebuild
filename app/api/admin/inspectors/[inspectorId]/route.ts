import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: { inspectorId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, service_area, role, is_active, ridechecker_max_daily_jobs, ridechecker_rating, ridechecker_quality_score, ridechecker_on_time_pct, created_at, updated_at")
      .eq("id", params.inspectorId)
      .in("role", ["ridechecker", "ridechecker_active"])
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "RideChecker not found" }, { status: 404 });
    }

    const ridechecker = {
      id: data.id,
      full_name: data.full_name || "Unknown",
      email: data.email,
      phone: data.phone,
      region: data.service_area || null,
      is_active: data.role === "ridechecker_active",
      max_daily_capacity: data.ridechecker_max_daily_jobs ?? 5,
      rating: data.ridechecker_rating,
      quality_score: data.ridechecker_quality_score,
      on_time_pct: data.ridechecker_on_time_pct,
      role: data.role,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return NextResponse.json({ inspector: ridechecker });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const updateRideCheckerSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  region: z.string().max(200).optional().nullable(),
  is_active: z.boolean().optional(),
  max_daily_capacity: z.number().int().min(1).max(20).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { inspectorId: string } },
) {
  try {
    const result = await requireRole(["operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = updateRideCheckerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.full_name !== undefined) updatePayload.full_name = parsed.data.full_name;
    if (parsed.data.email !== undefined) updatePayload.email = parsed.data.email;
    if (parsed.data.phone !== undefined) updatePayload.phone = parsed.data.phone;
    if (parsed.data.region !== undefined) updatePayload.service_area = parsed.data.region;
    if (parsed.data.max_daily_capacity !== undefined) updatePayload.ridechecker_max_daily_jobs = parsed.data.max_daily_capacity;
    if (parsed.data.is_active !== undefined) {
      updatePayload.role = parsed.data.is_active ? "ridechecker_active" : "ridechecker";
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", params.inspectorId);

    if (error) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "ridechecker.updated",
      resourceId: params.inspectorId,
      metadata: { resourceType: "ridechecker" },
      newValue: parsed.data,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
