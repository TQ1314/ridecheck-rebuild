import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { calcOffer } from "@/lib/compensation/calcOffer";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── GET — fetch current offer + recent history ─────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole([
      "operations", "operations_lead", "ops_lead", "admin", "owner", "ops",
    ]);
    if (!isAuthorized(result)) return result.error;

    const { data: current } = await supabaseAdmin
      .from("rc_compensation_offers")
      .select("*")
      .eq("order_id", params.orderId)
      .eq("is_current", true)
      .maybeSingle();

    const { data: history } = await supabaseAdmin
      .from("rc_compensation_offers")
      .select("id, version, total_offer, pay_status, calculated_at, saved_at, package_type, distance_miles, is_same_day, is_rush, surge_bonus, override_reason, override_approved_at")
      .eq("order_id", params.orderId)
      .order("version", { ascending: false })
      .limit(10);

    return NextResponse.json({ current: current ?? null, history: history ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST — calculate (preview) or take an action ──────────────────────────
const calcSchema = z.object({
  action: z.enum([
    "calculate",
    "save",
    "request_override",
    "approve_override",
    "reject_override",
    "add_surge",
  ]),
  // For calculate / save
  package_type:     z.string().optional(),
  distance_miles:   z.number().min(0).max(500).optional(),
  seller_available_date: z.string().nullable().optional(),
  seller_available_time: z.string().nullable().optional(),
  preferred_date:   z.string().nullable().optional(),
  // For save — accept manual overrides of individual bonuses
  base_pay_override:       z.number().int().min(0).max(500).optional(),
  distance_bonus_override: z.number().int().min(0).max(200).optional(),
  same_day_bonus_override: z.number().int().min(0).max(200).optional(),
  rush_bonus_override:     z.number().int().min(0).max(200).optional(),
  // For override
  override_reason: z.string().max(500).optional(),
  // For add_surge
  surge_amount: z.number().int().min(0).max(500).optional(),
  surge_note:   z.string().max(500).optional(),
  // For reject_override
  rejection_reason: z.string().max(500).optional(),
});

const OPS_LEAD_ROLES = ["operations_lead", "ops_lead", "admin", "owner"];
const ALL_OPS_ROLES  = ["operations", "operations_lead", "ops_lead", "admin", "owner", "ops"];

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(ALL_OPS_ROLES);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const body = await req.json();
    const parsed = calcSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Fetch order for context
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, package, preferred_date, seller_available_date, seller_available_time, base_pay")
      .eq("id", params.orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const pkgType       = data.package_type   ?? (order as any).package       ?? "standard";
    const prefDate      = data.preferred_date  ?? (order as any).preferred_date ?? null;
    const sellerDate    = data.seller_available_date ?? (order as any).seller_available_date ?? null;
    const sellerTime    = data.seller_available_time ?? (order as any).seller_available_time ?? null;
    const distanceMiles = data.distance_miles;

    // ── CALCULATE (preview only, no DB write) ────────────────────────────
    if (data.action === "calculate") {
      const result = calcOffer({
        packageType: pkgType,
        distanceMiles,
        preferredDate: prefDate,
        sellerAvailableDate: sellerDate,
        sellerAvailableTime: sellerTime,
        surgeBonus: 0,
      });

      await writeOrderEvent({
        orderId: params.orderId,
        eventType: "compensation.calculated",
        actorId: actor.userId,
        actorEmail: actor.email,
        details: {
          ...result,
          package_type: pkgType,
          distance_miles: distanceMiles ?? null,
        },
      });

      return NextResponse.json({ preview: result });
    }

    // ── SAVE ─────────────────────────────────────────────────────────────
    if (data.action === "save") {
      // Ops lead required for manual_review or 40+ miles
      const preview = calcOffer({
        packageType: pkgType,
        distanceMiles,
        preferredDate: prefDate,
        sellerAvailableDate: sellerDate,
        sellerAvailableTime: sellerTime,
        surgeBonus: 0,
      });

      if (preview.requiresOpsLead && !OPS_LEAD_ROLES.includes(actor.role)) {
        return NextResponse.json(
          { error: "This assignment requires Ops Lead approval (distance > 40 miles)." },
          { status: 403 }
        );
      }

      // Accept manual overrides from ops_lead / admin / owner
      const isLead = OPS_LEAD_ROLES.includes(actor.role);
      const basePay      = isLead && data.base_pay_override       != null ? data.base_pay_override       : preview.basePay;
      const distBonus    = isLead && data.distance_bonus_override  != null ? data.distance_bonus_override  : preview.distanceBonus;
      const sameDayBonus = isLead && data.same_day_bonus_override  != null ? data.same_day_bonus_override  : preview.sameDayBonus;
      const rushBonus    = isLead && data.rush_bonus_override       != null ? data.rush_bonus_override       : preview.rushBonus;
      const surgeBonus   = 0; // surge is a separate action
      const totalOffer   = basePay + distBonus + sameDayBonus + rushBonus + surgeBonus;

      const now = new Date().toISOString();

      // Fetch current version number
      const { data: lastOffer } = await supabaseAdmin
        .from("rc_compensation_offers")
        .select("version")
        .eq("order_id", params.orderId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = ((lastOffer as any)?.version ?? 0) + 1;

      // Mark previous current offers as not current
      await supabaseAdmin
        .from("rc_compensation_offers")
        .update({ is_current: false })
        .eq("order_id", params.orderId)
        .eq("is_current", true);

      // Insert new offer
      const { data: newOffer, error: insertErr } = await supabaseAdmin
        .from("rc_compensation_offers")
        .insert({
          order_id:       params.orderId,
          version:        nextVersion,
          base_pay:       basePay,
          distance_bonus: distBonus,
          same_day_bonus: sameDayBonus,
          rush_bonus:     rushBonus,
          surge_bonus:    surgeBonus,
          total_offer:    totalOffer,
          package_type:   pkgType,
          distance_miles: distanceMiles ?? null,
          is_same_day:    preview.isSameDay,
          is_rush:        preview.isRush,
          is_current:     true,
          is_manual_review: preview.isManualReview,
          requires_ops_lead: preview.requiresOpsLead,
          pay_status:     "saved",
          saved_by:       actor.userId,
          saved_at:       now,
          calculated_at:  now,
        })
        .select()
        .single();

      if (insertErr || !newOffer) {
        return NextResponse.json({ error: "Failed to save offer" }, { status: 500 });
      }

      // Update orders.base_pay so the existing assignment gate continues to work
      await supabaseAdmin
        .from("orders")
        .update({ base_pay: totalOffer, current_offer: totalOffer })
        .eq("id", params.orderId);

      await Promise.allSettled([
        writeOrderEvent({
          orderId: params.orderId,
          eventType: "compensation.saved",
          actorId: actor.userId,
          actorEmail: actor.email,
          details: {
            offer_id: (newOffer as any).id,
            version: nextVersion,
            base_pay: basePay,
            distance_bonus: distBonus,
            same_day_bonus: sameDayBonus,
            rush_bonus: rushBonus,
            total_offer: totalOffer,
            package_type: pkgType,
            previous_base_pay: (order as any).base_pay ?? 0,
          },
        }),
        writeAuditLog({
          actorId: actor.userId,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "compensation.saved",
          resourceId: params.orderId,
          oldValue: { base_pay: (order as any).base_pay ?? 0 },
          newValue: { base_pay: totalOffer, offer_id: (newOffer as any).id },
        }),
      ]);

      return NextResponse.json({ offer: newOffer, total_offer: totalOffer });
    }

    // ── For override/surge actions, we need an existing saved offer ────────
    const { data: currentOffer, error: offerErr } = await supabaseAdmin
      .from("rc_compensation_offers")
      .select("*")
      .eq("order_id", params.orderId)
      .eq("is_current", true)
      .maybeSingle();

    // ── REQUEST OVERRIDE ──────────────────────────────────────────────────
    if (data.action === "request_override") {
      if (!data.override_reason?.trim()) {
        return NextResponse.json(
          { error: "Override reason is required." },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();

      if (currentOffer) {
        await supabaseAdmin
          .from("rc_compensation_offers")
          .update({
            pay_status:              "override_requested",
            override_requested_by:   actor.userId,
            override_requested_at:   now,
            override_reason:         data.override_reason,
          })
          .eq("id", (currentOffer as any).id);
      } else {
        // No existing offer — create a placeholder
        await supabaseAdmin.from("rc_compensation_offers").insert({
          order_id:              params.orderId,
          version:               1,
          is_current:            true,
          pay_status:            "override_requested",
          override_requested_by: actor.userId,
          override_requested_at: now,
          override_reason:       data.override_reason,
          package_type:          pkgType,
          is_manual_review:      true,
          calculated_at:         now,
        });
      }

      await Promise.allSettled([
        writeOrderEvent({
          orderId: params.orderId,
          eventType: "compensation.override_requested",
          actorId: actor.userId,
          actorEmail: actor.email,
          details: { reason: data.override_reason },
        }),
        writeAuditLog({
          actorId: actor.userId,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "compensation.override_requested",
          resourceId: params.orderId,
          newValue: { reason: data.override_reason },
        }),
      ]);

      return NextResponse.json({ success: true, pay_status: "override_requested" });
    }

    // ── APPROVE OVERRIDE (ops_lead / admin / owner only) ─────────────────
    if (data.action === "approve_override") {
      if (!OPS_LEAD_ROLES.includes(actor.role)) {
        return NextResponse.json(
          { error: "Only Ops Lead, Admin, or Owner can approve overrides." },
          { status: 403 }
        );
      }
      if (!currentOffer) {
        return NextResponse.json({ error: "No current offer found to approve." }, { status: 404 });
      }

      const now = new Date().toISOString();

      // Accept manual base_pay if provided (ops_lead can set any amount)
      const approvedBase  = data.base_pay_override       ?? (currentOffer as any).base_pay       ?? 0;
      const approvedDist  = data.distance_bonus_override  ?? (currentOffer as any).distance_bonus  ?? 0;
      const approvedSame  = data.same_day_bonus_override  ?? (currentOffer as any).same_day_bonus  ?? 0;
      const approvedRush  = data.rush_bonus_override       ?? (currentOffer as any).rush_bonus       ?? 0;
      const approvedSurge = (currentOffer as any).surge_bonus ?? 0;
      const approvedTotal = approvedBase + approvedDist + approvedSame + approvedRush + approvedSurge;

      await supabaseAdmin
        .from("rc_compensation_offers")
        .update({
          pay_status:            "override_approved",
          override_approved_by:  actor.userId,
          override_approved_at:  now,
          base_pay:              approvedBase,
          distance_bonus:        approvedDist,
          same_day_bonus:        approvedSame,
          rush_bonus:            approvedRush,
          total_offer:           approvedTotal,
          saved_by:              actor.userId,
          saved_at:              now,
        })
        .eq("id", (currentOffer as any).id);

      // Sync to orders.base_pay
      await supabaseAdmin
        .from("orders")
        .update({ base_pay: approvedTotal, current_offer: approvedTotal })
        .eq("id", params.orderId);

      await Promise.allSettled([
        writeOrderEvent({
          orderId: params.orderId,
          eventType: "compensation.override_approved",
          actorId: actor.userId,
          actorEmail: actor.email,
          details: {
            offer_id: (currentOffer as any).id,
            total_offer: approvedTotal,
            previous_total: (currentOffer as any).total_offer ?? 0,
          },
        }),
        writeAuditLog({
          actorId: actor.userId,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "compensation.override_approved",
          resourceId: params.orderId,
          oldValue: { total_offer: (currentOffer as any).total_offer ?? 0 },
          newValue: { total_offer: approvedTotal },
        }),
      ]);

      return NextResponse.json({ success: true, pay_status: "override_approved", total_offer: approvedTotal });
    }

    // ── REJECT OVERRIDE (ops_lead / admin / owner only) ───────────────────
    if (data.action === "reject_override") {
      if (!OPS_LEAD_ROLES.includes(actor.role)) {
        return NextResponse.json(
          { error: "Only Ops Lead, Admin, or Owner can reject overrides." },
          { status: 403 }
        );
      }
      if (!currentOffer) {
        return NextResponse.json({ error: "No current offer found." }, { status: 404 });
      }

      const now = new Date().toISOString();
      await supabaseAdmin
        .from("rc_compensation_offers")
        .update({
          pay_status:               "saved",
          override_rejected_by:     actor.userId,
          override_rejected_at:     now,
          override_rejection_reason: data.rejection_reason ?? null,
        })
        .eq("id", (currentOffer as any).id);

      await Promise.allSettled([
        writeOrderEvent({
          orderId: params.orderId,
          eventType: "compensation.override_rejected",
          actorId: actor.userId,
          actorEmail: actor.email,
          details: { reason: data.rejection_reason ?? null },
        }),
        writeAuditLog({
          actorId: actor.userId,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "compensation.override_rejected",
          resourceId: params.orderId,
          newValue: { reason: data.rejection_reason ?? null },
        }),
      ]);

      return NextResponse.json({ success: true, pay_status: "saved" });
    }

    // ── ADD SURGE (ops_lead / admin / owner only) ─────────────────────────
    if (data.action === "add_surge") {
      if (!OPS_LEAD_ROLES.includes(actor.role)) {
        return NextResponse.json(
          { error: "Only Ops Lead, Admin, or Owner can add a surge bonus." },
          { status: 403 }
        );
      }

      const surgeAmount = data.surge_amount ?? 0;

      if (currentOffer) {
        const now = new Date().toISOString();
        const prevTotal  = (currentOffer as any).total_offer ?? 0;
        const prevSurge  = (currentOffer as any).surge_bonus ?? 0;
        const newSurge   = prevSurge + surgeAmount;
        const newTotal   = prevTotal - prevSurge + newSurge;

        await supabaseAdmin
          .from("rc_compensation_offers")
          .update({
            surge_bonus:    newSurge,
            total_offer:    newTotal,
            surge_added_by: actor.userId,
            surge_added_at: now,
            surge_note:     data.surge_note ?? null,
          })
          .eq("id", (currentOffer as any).id);

        // Sync to orders
        await supabaseAdmin
          .from("orders")
          .update({ base_pay: newTotal, current_offer: newTotal, boost_amount: newSurge })
          .eq("id", params.orderId);

        await Promise.allSettled([
          writeOrderEvent({
            orderId: params.orderId,
            eventType: "compensation.surge_added",
            actorId: actor.userId,
            actorEmail: actor.email,
            details: {
              surge_amount: surgeAmount,
              new_surge_total: newSurge,
              new_offer_total: newTotal,
              note: data.surge_note ?? null,
            },
          }),
          writeAuditLog({
            actorId: actor.userId,
            actorEmail: actor.email,
            actorRole: actor.role,
            action: "compensation.surge_added",
            resourceId: params.orderId,
            oldValue: { total_offer: prevTotal, surge_bonus: prevSurge },
            newValue: { total_offer: newTotal, surge_bonus: newSurge },
          }),
        ]);

        return NextResponse.json({ success: true, total_offer: newTotal, surge_bonus: newSurge });
      }

      return NextResponse.json({ error: "No current offer to apply surge to. Save an offer first." }, { status: 400 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
