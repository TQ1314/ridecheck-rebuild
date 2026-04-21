import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, service_area, role, is_active, ridechecker_max_daily_jobs, ridechecker_rating, ridechecker_quality_score, ridechecker_on_time_pct, created_at, updated_at")
      .in("role", ["ridechecker", "ridechecker_active"])
      .order("full_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch RideCheckers" }, { status: 500 });
    }

    const ridecheckers = (data || []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name || "Unknown",
      email: p.email,
      phone: p.phone,
      region: p.service_area || null,
      is_active: p.role === "ridechecker_active",
      max_daily_capacity: p.ridechecker_max_daily_jobs ?? 5,
      rating: p.ridechecker_rating,
      quality_score: p.ridechecker_quality_score,
      on_time_pct: p.ridechecker_on_time_pct,
      role: p.role,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    return NextResponse.json({ inspectors: ridecheckers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const createRideCheckerSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(20).optional().nullable(),
  region: z.string().max(200).optional().nullable(),
  max_daily_capacity: z.number().int().min(1).max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const result = await requireRole(["operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = createRideCheckerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("email", parsed.data.email)
      .single();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          role: "ridechecker",
          full_name: parsed.data.full_name,
          phone: parsed.data.phone || null,
          service_area: parsed.data.region || null,
          ridechecker_max_daily_jobs: parsed.data.max_daily_capacity || 5,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json({ error: "Failed to update profile to RideChecker" }, { status: 500 });
      }

      await writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "ridechecker.promoted",
        resourceId: existing.id,
        metadata: { resourceType: "ridechecker" },
        newValue: { full_name: parsed.data.full_name, region: parsed.data.region },
      });

      return NextResponse.json({ inspector: { id: existing.id, full_name: parsed.data.full_name } });
    }

    return NextResponse.json(
      { error: "No account found with that email. The RideChecker must apply first at /careers, then you can activate them here." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
