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
  return pkg.charAt(0).toUpperCase() + pkg.slice(1);
}
