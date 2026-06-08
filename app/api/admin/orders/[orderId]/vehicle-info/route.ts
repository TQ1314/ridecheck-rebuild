import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized, writeAuditLog, writeOrderEvent } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PACKAGE_ORDER: Record<string, number> = {
  standard: 0,
  basic: 0,
  plus: 1,
  premium: 2,
  exotic: 3,
};

const bodySchema = z.object({
  listing_url:               z.string().nullable().optional(),
  vehicle_year:              z.coerce.number().int().min(1900).max(2099).optional(),
  vehicle_make:              z.string().min(1).max(100).optional(),
  vehicle_model:             z.string().min(1).max(100).optional(),
  vehicle_trim:              z.string().nullable().optional(),
  vehicle_location:          z.string().min(1).max(200).optional(),
  seller_name:               z.string().nullable().optional(),
  seller_phone:              z.string().nullable().optional(),
  package:                   z.enum(["standard", "basic", "plus", "premium", "exotic"]).optional(),
  ops_internal_note:         z.string().nullable().optional(),
  mark_needs_buyer_info:     z.boolean().optional(),
  restore_to_contact_seller: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const result = await requireRole([
      "operations", "operations_lead", "ops_lead", "admin", "owner", "ops",
    ]);
    if (!isAuthorized(result)) return result.error;
    const { actor } = result;

    const rawBody = await req.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;

    // Fetch current order (need current values for diff + rules)
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select(
        "id, payment_status, ops_status, booking_type, " +
        "listing_url, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, " +
        "vehicle_location, seller_name, seller_phone, package, " +
        "base_price, final_price, ops_internal_note"
      )
      .eq("id", params.orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Build update payload — never touch payment_status
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Track changed fields for timeline event
    const changedFields: string[] = [];
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    function trackChange(field: string, oldVal: any, newVal: any) {
      if (newVal === undefined) return;
      const changed = String(newVal ?? "") !== String(oldVal ?? "");
      if (changed) {
        changedFields.push(field);
        oldValues[field] = oldVal;
        newValues[field] = newVal;
      }
      updatePayload[field] = newVal;
    }

    trackChange("listing_url",      (order as any).listing_url,      body.listing_url);
    trackChange("vehicle_year",     (order as any).vehicle_year,     body.vehicle_year);
    trackChange("vehicle_make",     (order as any).vehicle_make,     body.vehicle_make);
    trackChange("vehicle_model",    (order as any).vehicle_model,    body.vehicle_model);
    trackChange("vehicle_trim",     (order as any).vehicle_trim,     body.vehicle_trim);
    trackChange("vehicle_location", (order as any).vehicle_location, body.vehicle_location);
    trackChange("seller_name",      (order as any).seller_name,      body.seller_name);
    trackChange("seller_phone",     (order as any).seller_phone,     body.seller_phone);

    // Package change
    const oldPkg = (order as any).package as string | undefined;
    const newPkg = body.package;
    let packageUpgraded = false;
    let upgradeDiffCents: number | null = null;
    let upgradeNewPriceCents: number | null = null;

    if (newPkg && newPkg !== oldPkg) {
      const oldRank = PACKAGE_ORDER[oldPkg ?? "standard"] ?? 0;
      const newRank = PACKAGE_ORDER[newPkg] ?? 0;

      if (newRank > oldRank) {
        packageUpgraded = true;

        // Look up the new package price from tier_pricing
        const { data: pricingRows } = await supabaseAdmin
          .from("tier_pricing")
          .select("*")
          .limit(50);

        if (pricingRows && pricingRows.length > 0) {
          // Find a price row matching the new package (try common column names)
          const row = (pricingRows as any[]).find(
            (r: any) =>
              (r.package_type || r.package || r.tier || "").toLowerCase() === newPkg.toLowerCase()
          );
          if (row) {
            const newPriceCents =
              (row.price_cents ?? row.amount_cents ?? row.price ?? 0) as number;
            const currentFinalCents = Math.round(Number((order as any).final_price ?? 0) * 100);
            upgradeDiffCents = Math.max(0, newPriceCents - currentFinalCents);
            upgradeNewPriceCents = newPriceCents;
          }
        }
      }

      trackChange("package", oldPkg, newPkg);
    }

    // Internal ops note
    if (body.ops_internal_note !== undefined) {
      updatePayload.ops_internal_note = body.ops_internal_note;
    }

    // Ops status transitions — never touch payment_status
    let opsStatusChanged = false;
    const currentOpsStatus = (order as any).ops_status as string;

    if (body.mark_needs_buyer_info) {
      updatePayload.ops_status = "needs_buyer_info";
      if (currentOpsStatus !== "needs_buyer_info") {
        changedFields.push("ops_status");
        oldValues.ops_status = currentOpsStatus;
        newValues.ops_status = "needs_buyer_info";
        opsStatusChanged = true;
      }
    } else if (body.restore_to_contact_seller && currentOpsStatus === "needs_buyer_info") {
      updatePayload.ops_status = "contact_seller";
      changedFields.push("ops_status");
      oldValues.ops_status = "needs_buyer_info";
      newValues.ops_status = "contact_seller";
      opsStatusChanged = true;
    }

    if (changedFields.length === 0) {
      return NextResponse.json({ success: true, changed: false, message: "No changes detected" });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", params.orderId);

    if (updateErr) {
      console.error("[Vehicle Info] DB update failed", updateErr);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    // Timeline event
    await Promise.all([
      writeOrderEvent({
        orderId: params.orderId,
        eventType: opsStatusChanged
          ? newValues.ops_status === "needs_buyer_info"
            ? "marked_needs_buyer_info"
            : "vehicle_info_corrected"
          : "vehicle_info_updated",
        actorId:    actor.userId,
        actorEmail: actor.email,
        details: {
          changed_fields:     changedFields,
          old_values:         oldValues,
          new_values:         newValues,
          ...(body.ops_internal_note ? { note: body.ops_internal_note } : {}),
          ...(packageUpgraded ? { package_upgraded: true, new_package: newPkg } : {}),
        },
      }),
      writeAuditLog({
        actorId:    actor.userId,
        actorEmail: actor.email,
        actorRole:  actor.role,
        action:     "order.vehicle_info_updated",
        resourceId: params.orderId,
        oldValue:   oldValues,
        newValue:   newValues,
      }),
    ]);

    const response: Record<string, any> = {
      success:        true,
      changed:        true,
      changed_fields: changedFields,
    };

    if (packageUpgraded) {
      response.package_upgraded    = true;
      response.old_package         = oldPkg;
      response.new_package         = newPkg;
      response.upgrade_diff_cents  = upgradeDiffCents;
      response.upgrade_new_price_cents = upgradeNewPriceCents;
    }

    if (opsStatusChanged) {
      response.ops_status = newValues.ops_status;
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[Vehicle Info] Unhandled error", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
