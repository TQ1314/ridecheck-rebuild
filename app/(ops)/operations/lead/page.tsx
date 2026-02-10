"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderTable } from "@/components/orders/OrderTable";
import { Users, AlertTriangle } from "lucide-react";

export default function LeadPage() {
  const supabase = createClient();
  const [unassigned, setUnassigned] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .is("assigned_ops_id", null)
        .not("status", "in", '("completed","cancelled")')
        .order("created_at", { ascending: true });
      if (data) setUnassigned(data);
      setLoading(false);
    }
    load();
  }, []);

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
          Lead Tools
        </h1>
        <p className="text-sm text-muted-foreground">
          Assign and manage operations staff
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Unassigned Orders ({unassigned.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable
            orders={unassigned}
            basePath="/operations/orders"
            showCustomer
          />
        </CardContent>
      </Card>
    </div>
  );
}
