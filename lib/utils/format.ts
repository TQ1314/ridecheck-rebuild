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

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
