"use client";

import { useEffect, useState, useCallback } from "react";
import type { Order } from "@/types/orders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelative, statusLabel, bookingTypeLabel, packageLabel } from "@/lib/utils/format";
import Link from "next/link";

const OPS_STATUSES = [
  "all",
  "new",
  "seller_outreach",
  "seller_confirmed",
  "payment_pending",
  "payment_received",
  "inspector_assigned",
  "scheduled",
  "in_progress",
  "report_drafting",
  "report_review",
  "delivered",
  "completed",
  "on_hold",
  "cancelled",
];

const BOOKING_TYPES = ["all", "self_arrange", "concierge"];
const PACKAGES = ["all", "standard", "plus", "premium", "exotic"];

function getSlaFlags(order: Order): { label: string; variant: "destructive" | "default" }[] {
  const flags: { label: string; variant: "destructive" | "default" }[] = [];
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  if (order.ops_status === "new" && now - new Date(order.created_at).getTime() > TWO_HOURS) {
    flags.push({ label: "Stale", variant: "destructive" });
  }
  if ((order.seller_contact_attempts || 0) >= 3 && !order.seller_confirmed_at) {
    flags.push({ label: "Seller Lag", variant: "default" });
  }
  if (order.payment_requested_at && !order.paid_at && now - new Date(order.payment_requested_at).getTime() > SIX_HOURS) {
    flags.push({ label: "Payment Lag", variant: "default" });
  }
  if (order.inspection_scheduled_for && !order.inspection_completed_at && new Date(order.inspection_scheduled_for).getTime() < now) {
    flags.push({ label: "Overdue", variant: "destructive" });
  }
  return flags;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opsFilter, setOpsFilter] = useState("all");
  const [bookingFilter, setBookingFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (opsFilter !== "all") params.set("ops_status", opsFilter);
      if (bookingFilter !== "all") params.set("booking_type", bookingFilter);
      if (packageFilter !== "all") params.set("package", packageFilter);
      const url = `/api/admin/orders${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        setError("Failed to load orders");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
      else if (data?.orders) setOrders(data.orders);
      else setOrders([]);
    } catch {
      setError("Failed to load orders");
    }
    setLoading(false);
  }, [opsFilter, bookingFilter, packageFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          FIFO Operations Queue
        </h1>
        <p className="text-sm text-muted-foreground">
          Orders sorted by priority (desc) then created date (asc)
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={opsFilter} onValueChange={setOpsFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-ops-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPS_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Ops Statuses" : statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={bookingFilter} onValueChange={setBookingFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-booking-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOOKING_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "all" ? "All Booking Types" : bookingTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={packageFilter} onValueChange={setPackageFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-package-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PACKAGES.map((p) => (
              <SelectItem key={p} value={p}>
                {p === "all" ? "All Packages" : packageLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md" data-testid="text-error">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders match the current filters.</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Ops Status</TableHead>
                <TableHead>Seller Attempts</TableHead>
                <TableHead>RideChecker</TableHead>
                <TableHead>SLA Flag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const slaFlags = getSlaFlags(order);
                return (
                  <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                    <TableCell>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-primary hover:underline font-mono text-sm"
                        data-testid={`link-order-${order.id}`}
                      >
                        {order.id.slice(0, 8)}...
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelative(order.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {bookingTypeLabel(order.booking_type)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {packageLabel(order.package)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                        {statusLabel(order.ops_status || "new")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {order.seller_contact_attempts || 0}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.assigned_inspector_id ? order.assigned_inspector_id.slice(0, 8) + "..." : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {slaFlags.length === 0 && (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                        {slaFlags.map((flag) => (
                          <Badge
                            key={flag.label}
                            variant={flag.variant}
                            className={`no-default-hover-elevate no-default-active-elevate ${
                              flag.label === "Seller Lag"
                                ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30"
                                : flag.label === "Payment Lag"
                                ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
                                : ""
                            }`}
                            data-testid={`badge-sla-${flag.label.toLowerCase().replace(" ", "-")}`}
                          >
                            {flag.label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
