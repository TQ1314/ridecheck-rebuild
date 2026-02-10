"use client";

import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/utils/format";

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  payment_received: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  payment_requested: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  seller_contacted: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  seller_confirmed: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  inspection_scheduled: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  inspection_in_progress: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  report_drafting: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  report_ready: "bg-green-500/10 text-green-700 dark:text-green-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const PAYMENT_COLORS: Record<string, string> = {
  not_requested: "bg-muted text-muted-foreground",
  requested: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400",
  refunded: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`no-default-hover-elevate no-default-active-elevate border-0 font-medium ${STATUS_COLORS[status] || "bg-muted text-muted-foreground"}`}
      data-testid={`badge-status-${status}`}
    >
      {statusLabel(status)}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`no-default-hover-elevate no-default-active-elevate border-0 font-medium ${PAYMENT_COLORS[status] || "bg-muted text-muted-foreground"}`}
      data-testid={`badge-payment-${status}`}
    >
      {statusLabel(status)}
    </Badge>
  );
}
