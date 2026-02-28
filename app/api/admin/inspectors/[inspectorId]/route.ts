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
      .from("inspectors")
      .select("*")
      .eq("id", params.inspectorId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Inspector not found" }, { status: 404 });
    }

    return NextResponse.json({ inspector: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const updateInspectorSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  region: z.string().max(200).optional().nullable(),
  specialties: z.array(z.string()).optional().nullable(),
  is_active: z.boolean().optional(),
  max_daily_capacity: z.number().int().min(1).max(20).optional(),
  notes: z.string().optional().nullable(),
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
    const parsed = updateInspectorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updatePayload[key] = value;
      }
    }

    const { error } = await supabaseAdmin
      .from("inspectors")
      .update(updatePayload)
      .eq("id", params.inspectorId);

    if (error) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await writeAuditLog({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "inspector.updated",
      resourceId: params.inspectorId,
      metadata: { resourceType: "inspector" },
      newValue: parsed.data,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
