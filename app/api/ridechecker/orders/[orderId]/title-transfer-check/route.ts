import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";
import { calculateTransferReadiness, type TitleTransferInput } from "@/lib/risk-intelligence/title-transfer-check";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  vin:                             z.string().max(17).nullable().optional(),
  title_present:                   z.boolean().nullable().optional(),
  seller_name_on_title:            z.string().max(200).nullable().optional(),
  buyer_name_completed:            z.enum(["yes","no","not_applicable","unable_to_verify"]).nullable().optional(),
  odometer_disclosure_completed:   z.enum(["yes","no","not_applicable","unable_to_verify"]).nullable().optional(),
  lien_release_present:            z.enum(["yes","no","not_applicable","unable_to_verify"]).nullable().optional(),
  title_signed:                    z.enum(["yes","no","not_applicable","unable_to_verify"]).nullable().optional(),
  open_title:                      z.enum(["yes","no","unable_to_verify"]).nullable().optional(),
  vin_matches_title:               z.enum(["yes","no","unable_to_verify"]).nullable().optional(),
  state_of_title:                  z.string().max(50).nullable().optional(),
  title_photo_url:                 z.string().url().nullable().optional(),
  lien_release_photo_url:          z.string().url().nullable().optional(),
  odometer_disclosure_photo_url:   z.string().url().nullable().optional(),
  notes:                           z.string().max(2000).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const result = await requireRole(["ridechecker_active", "operations", "ops_lead", "operations_lead", "admin", "owner"]);
  if (!isAuthorized(result)) return result.error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  // Load order
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, seller_type, payment_status, payment_required, payment_override_approved")
    .eq("id", params.orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // RideChecker must be assigned to this order
  if (result.actor.role === "ridechecker_active") {
    const { data: assignment } = await supabaseAdmin
      .from("ridechecker_job_assignments")
      .select("id")
      .eq("order_id", params.orderId)
      .eq("ridechecker_id", result.actor.userId)
      .in("status", ["accepted", "inspection_started", "submitted"])
      .maybeSingle();
    if (!assignment) {
      return NextResponse.json({ error: "You are not assigned to this order" }, { status: 403 });
    }
  }

  // Payment gate
  if (!canProceedWithRideCheck(order as Parameters<typeof canProceedWithRideCheck>[0])) {
    return NextResponse.json(
      { error: PAYMENT_GATE_ERRORS.report_generation },
      { status: 402 }
    );
  }

  const d = parsed.data;

  // Calculate transfer readiness
  const input: TitleTransferInput = {
    title_present:                 d.title_present ?? null,
    seller_name_on_title:          d.seller_name_on_title ?? null,
    buyer_name_completed:          d.buyer_name_completed ?? null,
    odometer_disclosure_completed: d.odometer_disclosure_completed ?? null,
    lien_release_present:          d.lien_release_present ?? null,
    title_signed:                  d.title_signed ?? null,
    open_title:                    d.open_title ?? null,
    vin_matches_title:             d.vin_matches_title ?? null,
    state_of_title:                d.state_of_title ?? null,
  };
  const { transferReadinessStatus, riskFlags, summary } = calculateTransferReadiness(input);

  const now = new Date().toISOString();

  // Upsert (latest per order)
  const { error: upsertError } = await supabaseAdmin
    .from("vehicle_title_transfer_checks")
    .insert({
      order_id:                        params.orderId,
      vin:                             d.vin ?? null,
      title_present:                   d.title_present ?? null,
      seller_name_on_title:            d.seller_name_on_title ?? null,
      buyer_name_completed:            d.buyer_name_completed ?? null,
      odometer_disclosure_completed:   d.odometer_disclosure_completed ?? null,
      lien_release_present:            d.lien_release_present ?? null,
      title_signed:                    d.title_signed ?? null,
      open_title:                      d.open_title ?? null,
      vin_matches_title:               d.vin_matches_title ?? null,
      state_of_title:                  d.state_of_title ?? null,
      title_photo_url:                 d.title_photo_url ?? null,
      lien_release_photo_url:          d.lien_release_photo_url ?? null,
      odometer_disclosure_photo_url:   d.odometer_disclosure_photo_url ?? null,
      notes:                           d.notes ?? null,
      transfer_readiness_status:       transferReadinessStatus,
      risk_flags:                      riskFlags,
      checked_at:                      now,
      updated_at:                      now,
    });

  if (upsertError) {
    console.error("[title-transfer-check POST]", upsertError);
    return NextResponse.json({ error: "Failed to save title transfer check" }, { status: 500 });
  }

  return NextResponse.json({
    transfer_readiness_status: transferReadinessStatus,
    risk_flags:                riskFlags,
    summary,
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const result = await requireRole(["ridechecker_active", "operations", "ops_lead", "operations_lead", "admin", "owner", "qa_reviewer"]);
  if (!isAuthorized(result)) return result.error;

  // Load order for payment gate
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, seller_type, payment_status, payment_required, payment_override_approved")
    .eq("id", params.orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!canProceedWithRideCheck(order as Parameters<typeof canProceedWithRideCheck>[0])) {
    return NextResponse.json(
      { error: PAYMENT_GATE_ERRORS.report_generation },
      { status: 402 }
    );
  }

  const { data: check } = await supabaseAdmin
    .from("vehicle_title_transfer_checks")
    .select("*")
    .eq("order_id", params.orderId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ check: check ?? null });
}
