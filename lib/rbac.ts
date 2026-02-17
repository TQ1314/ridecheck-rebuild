import { NextResponse } from "next/server";
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
      .maybeSingle();

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
  allowedRoles: string[],
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
  result: { actor: Actor } | { error: NextResponse },
): result is { actor: Actor } {
  return "actor" in result;
}

/**
 * NOTE:
 * Your DB columns are:
 * - actor_user_id
 * - actor_email
 * - actor_roles
 * - action
 * - resource_id
 * - old_value
 * - new_value
 * - metadata
 * - ip_address
 *
 * It does NOT appear to have resource_type.
 */
export async function writeAuditLog(params: {
  actorId: string;
  actorEmail: string;
  actorRole: string; // single role string from profiles.role
  action: string;
  resourceId?: string; // uuid as string
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
}) {
  const payload = {
    actor_user_id: params.actorId,
    actor_email: params.actorEmail,
    actor_roles: params.actorRole, // DB column name is actor_roles (plural)
    action: params.action,
    resource_id: params.resourceId ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    metadata: params.metadata ?? null,
    ip_address: params.ipAddress ?? null,
  };

  const { error } = await supabaseAdmin.from("audit_log").insert(payload);
  if (error) {
    console.error("[audit_log insert error]", error);
  }
}

export async function writeOrderEvent(params: {
  orderId: string;
  eventType: string;
  actorId: string;
  actorEmail: string;
  details?: Record<string, any>;
  isInternal?: boolean;
}) {
  const { error } = await supabaseAdmin.from("order_events").insert({
    order_id: params.orderId,
    event_type: params.eventType,
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    details: params.details ?? null,
    is_internal: params.isInternal ?? false,
  });

  if (error) {
    console.error("[order_events insert error]", error);
  }
}
