import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const TRANSFER_BLOCKED_STATUSES = ["report_ready", "completed", "cancelled"] as const;

const schema = z.object({
  new_listing_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  new_vehicle_year: z.number().int().min(1900).max(2030),
  new_vehicle_make: z.string().min(1).max(80),
  new_vehicle_model: z.string().min(1).max(80),
  new_vehicle_trim: z.string().max(80).optional(),
  new_seller_name: z.string().max(120).optional(),
  new_seller_phone: z.string().max(30).optional(),
  new_seller_email: z.string().email().optional().or(z.literal("")),
  new_vehicle_location: z.string().min(1).max(200),
  seller_type: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    // Load original order — must belong to this buyer
    const { data: origOrderRaw } = await supabaseAdmin
      .from("orders")
      .select(
        "id, customer_id, customer_name, customer_email, customer_phone, " +
        "booking_type, package, final_price, seller_contact_status, status, " +
        "report_delivered_at, report_url"
      )
      .eq("id", params.orderId)
      .eq("customer_id", session.user.id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origOrder = origOrderRaw as any;

    if (!origOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Guard: seller must have declined
    if (origOrder.seller_contact_status !== "declined") {
      return NextResponse.json({
        error: "Transfer is only available when a seller has declined inspection.",
      }, { status: 400 });
    }

    // Guard: inspection must not be completed / report delivered
    if (TRANSFER_BLOCKED_STATUSES.includes(origOrder.status as any)) {
      return NextResponse.json({
        error: "Cannot transfer a RideCheck after the inspection has been completed.",
      }, { status: 400 });
    }
    if (origOrder.report_delivered_at || origOrder.report_url) {
      return NextResponse.json({
        error: "Cannot transfer a RideCheck after the report has been delivered.",
      }, { status: 400 });
    }

    // Load credit — must be active
    const { data: creditRaw } = await supabaseAdmin
      .from("transferable_order_credit")
      .select("*")
      .eq("original_order_id", params.orderId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const credit = creditRaw as any;

    if (!credit) {
      return NextResponse.json({
        error: "No active credit found for this order. Contact support.",
      }, { status: 400 });
    }
    if (credit.status !== "active") {
      return NextResponse.json({
        error: `This credit is ${credit.status} and cannot be applied to a new vehicle.`,
      }, { status: 400 });
    }
    if (new Date(credit.expires_at) < new Date()) {
      await supabaseAdmin
        .from("transferable_order_credit")
        .update({ status: "expired" })
        .eq("id", credit.id);
      return NextResponse.json({ error: "This credit has expired." }, { status: 400 });
    }

    const {
      new_listing_url,
      new_vehicle_year,
      new_vehicle_make,
      new_vehicle_model,
      new_vehicle_trim,
      new_seller_name,
      new_seller_phone,
      new_seller_email,
      new_vehicle_location,
      seller_type,
    } = parsed.data;

    const now = new Date().toISOString();

    // Determine package + pricing
    // If same package: no additional payment; if upgrading: flag for ops review
    const origPackage = origOrder.package ?? "standard";
    const creditCents = credit.remaining_amount_cents;

    // Create new order pre-marked as paid (credit covers it)
    const { data: newOrderRaw, error: createErr } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: origOrder.customer_id,
        customer_name: origOrder.customer_name,
        customer_email: origOrder.customer_email,
        customer_phone: origOrder.customer_phone,
        vehicle_year: new_vehicle_year,
        vehicle_make: new_vehicle_make,
        vehicle_model: new_vehicle_model,
        vehicle_trim: new_vehicle_trim ?? null,
        listing_url: new_listing_url || null,
        vehicle_location: new_vehicle_location,
        seller_name: new_seller_name ?? null,
        seller_phone: new_seller_phone ?? null,
        seller_email: new_seller_email || null,
        seller_type: seller_type ?? null,
        booking_type: origOrder.booking_type ?? "concierge",
        package: origPackage,
        base_price: origOrder.final_price ?? 0,
        discount_amount: 0,
        final_price: origOrder.final_price ?? 0,
        // Mark payment as fulfilled via credit
        payment_status: "paid",
        paid_at: now,
        status: "submitted",
        ops_status: "new",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newOrder = newOrderRaw as any;

    if (createErr || !newOrder) {
      console.error("[transfer order create error]", createErr);
      return NextResponse.json({ error: "Failed to create new order" }, { status: 500 });
    }

    // Mark credit as used
    await supabaseAdmin
      .from("transferable_order_credit")
      .update({ status: "used", used_order_id: newOrder.id })
      .eq("id", credit.id);

    // Log events on both orders
    await Promise.allSettled([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "ridechecker_credit_transferred",
        actorId: session.user.id,
        actorEmail: origOrder.customer_email,
        details: {
          new_order_id: newOrder.id,
          credit_id: credit.id,
          credit_amount_cents: creditCents,
          new_vehicle: `${new_vehicle_year} ${new_vehicle_make} ${new_vehicle_model}`,
        },
      }),
      writeOrderEvent({
        orderId: newOrder.id,
        eventType: "order_created_from_transfer",
        actorId: session.user.id,
        actorEmail: origOrder.customer_email,
        details: {
          original_order_id: params.orderId,
          credit_id: credit.id,
          credit_amount_cents: creditCents,
          seller_refused_original: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      new_order_id: newOrder.id,
      credit_applied_cents: creditCents,
    });
  } catch (err: any) {
    console.error("[transfer order error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
