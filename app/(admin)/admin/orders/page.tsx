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

const FILTERS = [
  "all", "submitted", "payment_received", "payment_requested",
  "seller_contacted", "seller_confirmed", "inspection_scheduled",
  "inspection_in_progress", "report_drafting", "report_ready",
  "completed", "cancelled",
];

export default function AdminOrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function load() {
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data } = await query;
      if (data) setOrders(data);
      setLoading(false);
    }
    setLoading(true);
    load();
  }, [statusFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">All Orders</h1>
          <p className="text-sm text-muted-foreground">
            Admin view of all orders
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((s) => (
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
        <OrderTable orders={orders} basePath="/admin/orders" showCustomer />
      )}
    </div>
  );
}
