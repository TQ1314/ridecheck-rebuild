"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/types/orders";
import { Card, CardContent } from "@/components/ui/card";
import { OrderTable } from "@/components/orders/OrderTable";
import { Package, DollarSign, Users, BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/pricing";

export default function AdminDashboard() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [ordersRes, usersRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true }),
      ]);
      if (ordersRes.data) setOrders(ordersRes.data);
      if (usersRes.count !== null) setUserCount(usersRes.count);
      setLoading(false);
    }
    load();
  }, []);

  const totalRevenue = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + Number(o.final_price), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Platform overview and management
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userCount}</p>
                <p className="text-xs text-muted-foreground">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/10">
                <BarChart3 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {orders.filter((o) => o.status === "completed").length}
                </p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Orders</h2>
        <OrderTable orders={orders} basePath="/admin/orders" showCustomer />
      </div>
    </div>
  );
}
