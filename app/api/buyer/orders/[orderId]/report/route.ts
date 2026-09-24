import { NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Authenticated buyer-only report access; storage paths never become public URLs. */
export async function GET(_: Request, { params }: { params: { orderId: string } }) {
  const supabase = createRouteHandlerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, customer_id, report_status, qa_status, report_storage_path")
    .eq("id", params.orderId)
    .eq("customer_id", session.user.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.report_status !== "delivered" || !order.report_storage_path) {
    return NextResponse.json({ error: "Report is not available until delivery succeeds." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from("reports")
    .createSignedUrl(order.report_storage_path, 15 * 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Unable to create secure report link" }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, expiresIn: 900 });
}