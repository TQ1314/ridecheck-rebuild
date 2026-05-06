import { format, formatDistanceToNow } from "date-fns";

export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
}

export function formatRelative(date: string | Date | null): string {
  if (!date) return "—";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown";

  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatOrderCode(
  orderNumber: number | null | undefined,
  createdAt?: string | Date | null
): string {
  if (!orderNumber) return "—";

  const year = createdAt
    ? new Date(createdAt).getFullYear()
    : new Date().getFullYear();

  return `RC-${year}-${String(orderNumber).padStart(7, "0")}`;
}

export function bookingTypeLabel(type: string): string {
  if (type === "self_arrange") return "Self-Arranged";
  if (type === "buyer_arranged") return "Buyer-Arranged";
  if (type === "concierge") return "Concierge";
  return type;
}

export function packageLabel(pkg: string): string {
  if (pkg === "standard") return "Basic";
  if (pkg === "premium") return "Plus";
  return pkg.charAt(0).toUpperCase() + pkg.slice(1);
}

/**
 * Converts raw order event detail objects into a concise, human-readable string
 * instead of raw JSON. Handles the most common event shapes.
 */
export function formatEventDetails(details: Record<string, any> | null | undefined): string | null {
  if (!details || typeof details !== "object") return null;

  // Status transitions
  if ("new_ops_status" in details && "old_ops_status" in details) {
    return `${statusLabel(details.old_ops_status)} → ${statusLabel(details.new_ops_status)}`;
  }
  if ("new_status" in details && "old_status" in details) {
    return `${statusLabel(details.old_status)} → ${statusLabel(details.new_status)}`;
  }

  // Seller contact attempt
  if ("channel" in details && "attempt_number" in details) {
    const dest = details.destination ? ` → ${details.destination}` : "";
    return `${statusLabel(details.channel)} attempt #${details.attempt_number}${dest}`;
  }

  // Seller contact outcome
  if ("outcome" in details && Object.keys(details).length <= 2) {
    const note = details.notes ? ` — ${details.notes}` : "";
    return `Outcome: ${statusLabel(details.outcome)}${note}`;
  }

  // Buyer / RC messages
  if ("message" in details && "channel" in details) {
    const ch = statusLabel(details.channel);
    const preview = (details.message as string).slice(0, 80);
    return `${ch}: "${preview}${details.message.length > 80 ? "…" : ""}"`;
  }

  // RC assignment / broadcast
  if ("ridechecker_name" in details) {
    const name = details.ridechecker_name;
    const reason = details.rejection_reason ? ` (${details.rejection_reason})` : "";
    const pay = details.offered_pay != null ? ` · $${details.offered_pay}` : "";
    return `${name}${pay}${reason}`;
  }
  if ("inspector_id" in details || "assignment_id" in details) {
    return `Inspector ID: ${(details.inspector_id || details.assignment_id || "").slice(0, 8)}…`;
  }

  // Payment
  if ("amount" in details && "payment_url" in details) {
    return `$${details.amount} — payment link sent`;
  }
  if ("stripe_reference" in details) {
    return `Stripe ref: ${details.stripe_reference}`;
  }

  // Decline enforcement
  if ("decline_count" in details) {
    return `Decline #${details.decline_count} in 30 days`;
  }

  // Nudge
  if ("nudge" in details || ("sms" in details && "email" in details)) {
    const parts: string[] = [];
    if (details.email) parts.push("email");
    if (details.sms) parts.push("SMS");
    return parts.length > 0 ? `Sent via ${parts.join(" & ")}` : null;
  }

  // Generic: render as "Key: Value" pairs, skip UUIDs and long strings
  const parts: string[] = [];
  for (const [key, val] of Object.entries(details)) {
    if (val == null) continue;
    const strVal = String(val);
    // Skip raw UUIDs, long strings, and nested objects
    if (/^[0-9a-f-]{36}$/i.test(strVal)) continue;
    if (strVal.length > 100) continue;
    if (typeof val === "object") continue;
    parts.push(`${statusLabel(key)}: ${strVal}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
