"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/types/orders";
import { OrderTable } from "@/components/orders/OrderTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { statusLabel } from "@/lib/utils/format";

const STATUS_OPTIONS = [
  "all",
  "submitted",
  "payment_received",
  "payment_requested",
  "inspection_scheduled",
  "inspection_in_progress",
  "report_ready",
  "completed",
  "cancelled",
];

export default function OrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      let query = supabase
        .from("orders")
        .select("*")
        .eq("customer_id", session.user.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data } = await query;
      if (data) setOrders(data);
      setLoading(false);
    }
    load();
  }, [statusFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            My Orders
          </h1>
          <p className="text-sm text-muted-foreground">
            View all your inspection orders
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Statuses" : statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <OrderTable orders={orders} basePath="/orders" />
      )}
    </div>
  );
}
