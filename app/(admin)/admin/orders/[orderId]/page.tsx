"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Order, ActivityLogEntry } from "@/types/orders";
import { OrderDetailPanel } from "@/components/orders/OrderDetailPanel";
import { StatusUpdateDialog } from "@/components/orders/StatusUpdateDialog";
import { AssignOpsDialog } from "@/components/orders/AssignOpsDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const supabase = createClient();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const [orderRes, activityRes] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).single(),
      supabase
        .from("activity_log")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
    ]);
    if (orderRes.data) setOrder(orderRes.data);
    if (activityRes.data) setActivities(activityRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [orderId]);

  const handleStatusUpdate = async (newStatus: string) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Status updated" });
    loadData();
  };

  const handleAssign = async (opsId: string) => {
    const res = await fetch(`/api/orders/${orderId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_ops_id: opsId }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Order assigned" });
    loadData();
  };

  const handleSendPayment = async () => {
    const res = await fetch(`/api/orders/${orderId}/send-payment`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Payment link sent" });
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/admin/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusUpdateDialog
            orderId={orderId}
            currentStatus={order.status}
            onUpdate={handleStatusUpdate}
          />
          <AssignOpsDialog
            orderId={orderId}
            currentOpsId={order.assigned_ops_id}
            onAssign={handleAssign}
          />
          {order.booking_type === "concierge" &&
            order.payment_status === "not_requested" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendPayment}
                data-testid="button-send-payment"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Payment Link
              </Button>
            )}
        </div>
      </div>
      <OrderDetailPanel order={order} activities={activities} />
    </div>
  );
}
