"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Order, ActivityLogEntry } from "@/types/orders";
import { OrderDetailPanel } from "@/components/orders/OrderDetailPanel";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const supabase = createClient();
  const [order, setOrder] = useState<Order | null>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("customer_id", session.user.id)
        .single();

      if (orderData) {
        setOrder(orderData);

        const { data: activityData } = await supabase
          .from("activity_log")
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: false });

        if (activityData) setActivities(activityData);
      }
      setLoading(false);
    }
    load();
  }, [orderId]);

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
        <Link href="/orders">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <Link href="/orders">
        <Button variant="ghost" size="sm" data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
      </Link>
      <OrderDetailPanel order={order} activities={activities} />
    </div>
  );
}
