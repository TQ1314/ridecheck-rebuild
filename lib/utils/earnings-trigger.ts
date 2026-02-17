import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRidecheckerPay } from "./earnings";

export async function createEarningForOrder(orderId: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_id, package, assigned_inspector_id, inspector_status, qa_status, ridechecker_pay")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!order || !order.assigned_inspector_id) return null;
  if (order.inspector_status !== "completed") return null;
  if (order.qa_status !== "approved") return null;

  const { data: existing } = await supabaseAdmin
    .from("ridechecker_earnings")
    .select("id")
    .eq("order_id", orderId)
    .eq("ridechecker_id", order.assigned_inspector_id)
    .maybeSingle();

  if (existing) return null;

  const amount = order.ridechecker_pay || getRidecheckerPay(order.package || "standard");

  const { data: earning, error } = await supabaseAdmin
    .from("ridechecker_earnings")
    .insert({
      ridechecker_id: order.assigned_inspector_id,
      order_id: orderId,
      package: order.package || "standard",
      amount,
      status: "pending",
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("[createEarningForOrder error]", error);
    return null;
  }

  await checkAndUpdateReferral(order.assigned_inspector_id);

  return earning;
}

async function checkAndUpdateReferral(ridecheckerId: string) {
  const { data: referral } = await supabaseAdmin
    .from("referrals")
    .select("*")
    .eq("referee_id", ridecheckerId)
    .eq("status", "pending")
    .maybeSingle();

  if (!referral) return;

  if (new Date(referral.expires_at) < new Date()) {
    await supabaseAdmin
      .from("referrals")
      .update({ status: "expired" })
      .eq("id", referral.id);
    return;
  }

  const { count } = await supabaseAdmin
    .from("ridechecker_earnings")
    .select("id", { count: "exact", head: true })
    .eq("ridechecker_id", ridecheckerId)
    .neq("package", "referral_bonus")
    .lte("created_at", referral.expires_at);

  const completedJobs = count || 0;

  await supabaseAdmin
    .from("referrals")
    .update({ referee_completed_jobs: completedJobs })
    .eq("id", referral.id);

  if (completedJobs >= 3) {
    await supabaseAdmin
      .from("referrals")
      .update({
        status: "qualified",
        qualified_at: new Date().toISOString(),
      })
      .eq("id", referral.id);

    await supabaseAdmin.from("ridechecker_earnings").insert([
      {
        ridechecker_id: referral.referrer_id,
        order_id: `referral-bonus-${referral.id}`,
        package: "referral_bonus",
        amount: referral.reward_amount,
        status: "pending",
      },
      {
        ridechecker_id: referral.referee_id,
        order_id: `referral-bonus-received-${referral.id}`,
        package: "referral_bonus",
        amount: referral.reward_amount,
        status: "pending",
      },
    ]);
  }
}
