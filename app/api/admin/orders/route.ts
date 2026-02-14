import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const result = await requireRole(["operations", "operations_lead", "owner"]);
    if (!isAuthorized(result)) return result.error;

    const url = new URL(req.url);
    const opsStatus = url.searchParams.get("ops_status");
    const status = url.searchParams.get("status");
    const bookingType = url.searchParams.get("booking_type");
    const pkg = url.searchParams.get("package");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let query = supabaseAdmin
      .from("orders")
      .select("*", { count: "exact" })
      .order("ops_priority", { ascending: false })
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (opsStatus && opsStatus !== "all") {
      query = query.eq("ops_status", opsStatus);
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (bookingType && bookingType !== "all") {
      query = query.eq("booking_type", bookingType);
    }
    if (pkg && pkg !== "all") {
      query = query.eq("package", pkg);
    }

    const { data: orders, count, error } = await query;

    if (error) {
      console.error("[Admin Orders Query Error]", error);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    return NextResponse.json({
      orders: orders || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
