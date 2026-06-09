import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { canProceedWithRideCheck, PAYMENT_GATE_ERRORS } from "@/lib/payment/payment-gate";
import { z } from "zod";
import { sendPreferred } from "@/lib/notifications/send-preferred";
import { buyerRetentionHtml, buyerRetentionSms } from "@/lib/email/templates/buyer-retention";

const outcomeSchema = z.object({
  outcome: z.enum(["accepted", "declined", "no_response", "invalid_contact"]),
  notes: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole(["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = outcomeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { outcome, notes } = parsed.data;

    // Payment gate
    const { data: gateOrder } = await supabaseAdmin
      .from("orders")
      .select("payment_status, payment_required, payment_override_approved")
      .eq("id", params.orderId)
      .single();

    if (!gateOrder || !canProceedWithRideCheck(gateOrder)) {
      return NextResponse.json({ error: PAYMENT_GATE_ERRORS.seller_outreach }, { status: 402 });
    }

    if (outcome === "no_response") {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("booking_type")
        .eq("id", params.orderId)
        .single();

      if (order?.booking_type === "concierge") {
        // Count actual non-buyer_message attempts from the log table — avoids counter drift
        const { count, error: countErr } = await supabaseAdmin
          .from("seller_contact_attempts")
          .select("id", { count: "exact", head: true })
          .eq("order_id", params.orderId)
          .neq("channel", "buyer_message");

        const actualCount = count ?? 0;
        console.log(`[seller-contact/outcome] orderId=${params.orderId} actualCount=${actualCount} outcome=${outcome}`);

        if (countErr) {
          console.error("[seller-contact/outcome] count error", countErr);
        }

        if (actualCount < 3) {
          return NextResponse.json(
            {
              error: `Concierge orders require at least 3 seller contact attempts before marking no_response. Found: ${actualCount}`,
            },
            { status: 400 },
          );
        }
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        seller_contact_status: outcome,
        seller_outcome_notes: notes || null,
        updated_at: now,
      })
      .eq("id", params.orderId);

    if (updateError) {
      console.error("[seller-contact/outcome] update error", updateError);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    const details: Record<string, any> = {
      outcome,
      ...(notes ? { notes } : {}),
    };

    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: "seller_contact_outcome",
        actorId: actor.userId,
        actorEmail: actor.email,
        details,
      }),
      writeAuditLog({
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.seller_contact_outcome",
        resourceId: params.orderId,
        newValue: details,
      }),
    ]);

    // ── Buyer Retention + Credit (non-fatal, only on seller decline) ─────────
    if (outcome === "declined") {
      void (async () => {
        try {
          const { data: orderRaw } = await supabaseAdmin
            .from("orders")
            .select(
              "id, customer_id, customer_email, customer_phone, customer_name, " +
              "vehicle_year, vehicle_make, vehicle_model, final_price, package, " +
              "listing_source, platform_source, payment_status"
            )
            .eq("id", params.orderId)
            .maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const order = orderRaw as any;

          if (!order) return;

          // Fetch buyer profile for notification_preferences
          const { data: buyerRaw } = await supabaseAdmin
            .from("profiles")
            .select("email, phone, notification_preferences")
            .eq("id", order.customer_id)
            .maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const buyer = buyerRaw as any;

          // Determine credit amount in cents
          const creditCents = Math.round((order.final_price ?? 0) * 100);

          // Create (or skip if already exists) a transferable credit record
          const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
          const { data: existingCreditRaw } = await supabaseAdmin
            .from("transferable_order_credit")
            .select("id")
            .eq("original_order_id", params.orderId)
            .maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existingCredit = existingCreditRaw as any;

          let creditId: string | null = existingCredit?.id ?? null;

          if (!existingCredit && creditCents > 0) {
            const { data: newCreditRaw } = await supabaseAdmin
              .from("transferable_order_credit")
              .insert({
                buyer_id: order.customer_id,
                original_order_id: params.orderId,
                credit_amount_cents: creditCents,
                remaining_amount_cents: creditCents,
                package_type: order.package ?? "standard",
                status: "active",
                expires_at: expiresAt,
              })
              .select("id")
              .single();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            creditId = (newCreditRaw as any)?.id ?? null;
          }

          // Log seller_refused_inspection event with analytics fields
          await writeOrderEvent({
            orderId: params.orderId,
            eventType: "seller_refused_inspection",
            actorId: actor.userId,
            actorEmail: actor.email,
            details: {
              seller_refused: true,
              listing_source: order.listing_source ?? null,
              platform_source: order.platform_source ?? null,
              credit_created: !!creditId,
              credit_id: creditId,
              credit_amount_cents: creditCents,
              notes: notes ?? null,
            },
          }).catch(() => {});

          // Send buyer retention notification via preferred channel
          const buyerEmail = buyer?.email ?? order.customer_email;
          const buyerPhone = buyer?.phone ?? order.customer_phone;
          const buyerPrefs = (buyer as any)?.notification_preferences ?? null;

          if (buyerEmail || buyerPhone) {
            const retentionParams = {
              buyerName: order.customer_name,
              vehicleYear: order.vehicle_year,
              vehicleMake: order.vehicle_make,
              vehicleModel: order.vehicle_model,
              orderId: params.orderId,
              creditExpiresAt: expiresAt,
            };

            await sendPreferred(
              { email: buyerEmail, phone: buyerPhone, notification_preferences: buyerPrefs },
              {
                subject: "Important: Seller Declined Inspection — Your RideCheck is Still Active",
                html: buyerRetentionHtml(retentionParams),
                smsBody: buyerRetentionSms(retentionParams),
              }
            );
          }
        } catch (retentionErr) {
          console.error("[buyer-retention error]", retentionErr);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      seller_contact_status: outcome,
    });
  } catch (err: any) {
    console.error("[seller-contact/outcome] unexpected error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
