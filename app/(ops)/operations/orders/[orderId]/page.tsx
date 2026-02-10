"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Order, ActivityLogEntry, Profile } from "@/types/orders";
import { OrderDetailPanel } from "@/components/orders/OrderDetailPanel";
import { StatusUpdateDialog } from "@/components/orders/StatusUpdateDialog";
import { AssignOpsDialog } from "@/components/orders/AssignOpsDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Upload } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { canUpdateStatus, canAssignOps, canSendPayment, type Role } from "@/lib/utils/roles";

export default function OpsOrderDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const supabase = createClient();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const [orderRes, activityRes, profileRes] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).single(),
      supabase
        .from("activity_log")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
    ]);

    if (orderRes.data) setOrder(orderRes.data);
    if (activityRes.data) setActivities(activityRes.data);
    if (profileRes.data) setProfile(profileRes.data);
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

  const role = (profile?.role || "operations") as Role;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/operations/orders">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {canUpdateStatus(role) && (
            <StatusUpdateDialog
              orderId={orderId}
              currentStatus={order.status}
              onUpdate={handleStatusUpdate}
            />
          )}
          {canAssignOps(role) && (
            <AssignOpsDialog
              orderId={orderId}
              currentOpsId={order.assigned_ops_id}
              onAssign={handleAssign}
            />
          )}
          {canSendPayment(role) &&
            order.booking_type === "concierge" &&
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
