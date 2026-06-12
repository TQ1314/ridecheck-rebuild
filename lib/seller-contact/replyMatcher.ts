/**
 * lib/seller-contact/replyMatcher.ts
 *
 * Matches an inbound seller message (SMS or email) to an open RideCheck order.
 *
 * Strategies (tried in priority order):
 *  1. reply_to_tag    — Parse RC-XXXX order number from tagged reply-to address
 *                       e.g.  replies+RC-1234@ridecheckauto.com
 *  2. subject_order_ref — Scan email subject for RC-NNNN pattern
 *  3. phone_lookup    — Match sender E.164 phone against orders.seller_phone
 *  4. email_lookup    — Match sender email against orders.seller_email
 *
 * Returns the matched order_id and which method succeeded, or null if unmatched.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface MatchResult {
  orderId:     string;
  orderNumber: string;
  method:      "reply_to_tag" | "subject_order_ref" | "phone_lookup" | "email_lookup";
}

/** Normalize a phone to E.164-ish digits-only for fuzzy comparison */
function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").replace(/^1/, "");
}

/**
 * Try to extract an RC order number from a tagged reply-to address.
 * Handles:  replies+RC-2026-000027@domain.com  or  replies+RC-1234@domain.com
 */
function extractOrderRefFromAddress(address: string): string | null {
  const m = address.match(/\+([Rr][Cc]-[\d-]+)/);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Extract order ref from an email subject line.
 * Matches: RC-2026-000027 or RC-1234
 */
function extractOrderRefFromSubject(subject: string): string | null {
  const m = subject.match(/\b(RC-[\d-]+)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** Look up an order by its order_number, returning only orders with active seller contact. */
async function findOrderByNumber(orderNumber: string): Promise<MatchResult | null> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, seller_contact_status")
    .ilike("order_number", orderNumber)
    .in("seller_contact_status", ["attempting", "confirmed", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { orderId: (data as any).id, orderNumber: (data as any).order_number, method: "reply_to_tag" };
}

/** Look up an order by seller phone number. Returns most recently contacted open order. */
async function findOrderByPhone(phone: string): Promise<MatchResult | null> {
  if (!phone) return null;
  const digits = normalizePhone(phone);
  if (digits.length < 7) return null;

  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, seller_phone, seller_contact_status")
    .not("seller_phone", "is", null)
    .in("seller_contact_status", ["attempting", "confirmed", "in_progress"])
    .order("seller_last_contact_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (!data) return null;

  const match = (data as any[]).find((o) => normalizePhone(o.seller_phone || "") === digits);
  if (!match) return null;

  return { orderId: match.id, orderNumber: match.order_number, method: "phone_lookup" };
}

/** Look up an order by seller email address. */
async function findOrderByEmail(email: string): Promise<MatchResult | null> {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();

  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, seller_email, seller_contact_status")
    .ilike("seller_email", normalized)
    .in("seller_contact_status", ["attempting", "confirmed", "in_progress"])
    .order("seller_last_contact_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { orderId: (data as any).id, orderNumber: (data as any).order_number, method: "email_lookup" };
}

/**
 * Main entry point. Try all match strategies and return the first one that succeeds.
 */
export async function matchReplyToOrder(params: {
  channel: "sms" | "email";
  fromAddress:  string;
  toAddress?:   string;
  subject?:     string;
}): Promise<MatchResult | null> {
  const { channel, fromAddress, toAddress, subject } = params;

  // Strategy 1: reply-to tag in the "to" address
  if (toAddress) {
    const ref = extractOrderRefFromAddress(toAddress);
    if (ref) {
      const r = await findOrderByNumber(ref);
      if (r) return { ...r, method: "reply_to_tag" };
    }
  }

  // Strategy 2: order ref in subject line (email only)
  if (channel === "email" && subject) {
    const ref = extractOrderRefFromSubject(subject);
    if (ref) {
      const r = await findOrderByNumber(ref);
      if (r) return { ...r, method: "subject_order_ref" };
    }
  }

  // Strategy 3: phone lookup (SMS primary)
  if (channel === "sms") {
    const r = await findOrderByPhone(fromAddress);
    if (r) return r;
  }

  // Strategy 4: email lookup
  if (channel === "email") {
    const r = await findOrderByEmail(fromAddress);
    if (r) return r;
  }

  // Strategy 3b: try phone for email channel too (in case seller provided a phone that matches)
  if (channel === "email" && fromAddress.includes("@") === false) {
    const r = await findOrderByPhone(fromAddress);
    if (r) return r;
  }

  return null;
}
