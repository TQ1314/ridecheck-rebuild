import { supabaseAdmin } from "@/lib/supabase/admin";

export async function checkIdempotency(key: string | null) {
  if (!key) return null;
  const { data } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("idempotency_key", key)
    .maybeSingle();
  return data;
}
