"use client";

import { useEffect, useState } from "react";
import type { Order, Inspector } from "@/types/orders";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, DollarSign, Users, Inbox } from "lucide-react";
import { formatCurrency } from "@/lib/utils/pricing";
import { formatRelative, statusLabel } from "@/lib/utils/format";
import Link from "next/link";

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [ordersRaw, inspectorsRaw] = await Promise.all([
          fetch("/api/admin/orders?limit=5"),
          fetch("/api/admin/inspectors"),
        ]);
        if (!ordersRaw.ok || !inspectorsRaw.ok) {
          setError("Failed to load dashboard data");
          setLoading(false);
          return;
        }
        const ordersRes = await ordersRaw.json();
        const inspectorsRes = await inspectorsRaw.json();
        if (Array.isArray(ordersRes)) setOrders(ordersRes);
        else if (ordersRes?.orders) setOrders(ordersRes.orders);
        if (Array.isArray(inspectorsRes)) setInspectors(inspectorsRes);
        else if (inspectorsRes?.inspectors) setInspectors(inspectorsRes.inspectors);
      } catch {
        setError("Failed to load dashboard data");
      }
      setLoading(false);
    }
    load();
  }, []);

  const totalOrders = orders.length;
  const newQueue = orders.filter((o) => o.ops_status === "new").length;
  const totalRevenue = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + Number(o.final_price), 0);
  const activeInspectors = inspectors.filter((i) => i.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md" data-testid="text-error">
          {error}
        </div>
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
                <p className="text-2xl font-bold" data-testid="stat-total-orders">{totalOrders}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10">
                <Inbox className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-new-queue">{newQueue}</p>
                <p className="text-xs text-muted-foreground">New Queue</p>
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
                <p className="text-2xl font-bold" data-testid="stat-revenue">{formatCurrency(totalRevenue)}</p>
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
                <p className="text-2xl font-bold" data-testid="stat-active-inspectors">{activeInspectors}</p>
                <p className="text-xs text-muted-foreground">Active Inspectors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Orders (FIFO Queue)</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Ops Status</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.slice(0, 5).map((order) => (
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
                      {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                        {statusLabel(order.ops_status || "new")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                        {statusLabel(order.payment_status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
