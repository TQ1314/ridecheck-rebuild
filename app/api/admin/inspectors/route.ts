import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog } from "@/lib/rbac";
import { z } from "zod";

export async function GET() {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const { data, error } = await supabaseAdmin
      .from("inspectors")
      .select("*")
      .order("full_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch inspectors" }, { status: 500 });
    }

    return NextResponse.json({ inspectors: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const createInspectorSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  region: z.string().max(200).optional().nullable(),
  specialties: z.array(z.string()).optional().nullable(),
  max_daily_capacity: z.number().int().min(1).max(20).optional(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const result = await requireRole(["operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = createInspectorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: inspector, error } = await supabaseAdmin
      .from("inspectors")
      .insert({
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        region: parsed.data.region || null,
        specialties: parsed.data.specialties || null,
        max_daily_capacity: parsed.data.max_daily_capacity || 3,
        notes: parsed.data.notes || null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create inspector" }, { status: 500 });
    }

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "inspector.created",
      resourceId: inspector.id,
      metadata: { resourceType: "inspector" },
      newValue: { full_name: parsed.data.full_name, region: parsed.data.region },
    });

    return NextResponse.json({ inspector });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
