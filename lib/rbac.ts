import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface Actor {
  userId: string;
  email: string;
  role: string;
  fullName: string;
}

export async function getActor(): Promise<Actor | null> {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return null;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name, email, is_active")
      .eq("id", session.user.id)
      .single();

    if (!profile || !profile.is_active) return null;

    return {
      userId: session.user.id,
      email: profile.email || session.user.email || "",
      role: profile.role,
      fullName: profile.full_name || "",
    };
  } catch {
    return null;
  }
}

export async function requireRole(
  allowedRoles: string[]
): Promise<{ actor: Actor } | { error: NextResponse }> {
  const actor = await getActor();

  if (!actor) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(actor.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { actor };
}

export function isAuthorized(
  result: { actor: Actor } | { error: NextResponse }
): result is { actor: Actor } {
  return "actor" in result;
}

export async function writeAuditLog(params: {
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
}) {
  await supabaseAdmin.from("audit_log").insert({
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    actor_role: params.actorRole,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId || null,
    old_value: params.oldValue || null,
    new_value: params.newValue || null,
    metadata: params.metadata || null,
    ip_address: params.ipAddress || null,
  });
}

export async function writeOrderEvent(params: {
  orderId: string;
  eventType: string;
  actorId: string;
  actorEmail: string;
  details?: Record<string, any>;
  isInternal?: boolean;
}) {
  await supabaseAdmin.from("order_events").insert({
    order_id: params.orderId,
    event_type: params.eventType,
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    details: params.details || null,
    is_internal: params.isInternal ?? false,
  });
}
