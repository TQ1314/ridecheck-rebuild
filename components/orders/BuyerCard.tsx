"use client";

import { useState } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Package, CreditCard, Send, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { packageLabel } from "@/lib/utils/format";

interface BuyerCardProps {
  order: Order;
  onRefresh: () => void;
}

function paymentBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
    case "requested":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Awaiting Payment</Badge>;
    case "not_requested":
      return <Badge variant="outline">Not Requested</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function BuyerCard({ order, onRefresh }: BuyerCardProps) {
  const { toast } = useToast();
  const [delivering, setDelivering] = useState(false);

  const canDeliver = order.report_status === "approved" || order.report_status === "generated";
  const alreadyDelivered = !!order.report_delivered_at;

  async function handleDeliverReport() {
    setDelivering(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/deliver-report`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Delivery failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Report sent to buyer!", description: "Email delivered via Resend." });
      onRefresh();
    } catch {
      toast({ title: "Failed to deliver report", variant: "destructive" });
    } finally {
      setDelivering(false);
    }
  }

  const buyerEmail = order.buyer_email || order.customer_email;
  const buyerPhone = order.buyer_phone || order.customer_phone;

  return (
    <Card data-testid="card-buyer">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Buyer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{order.customer_name || "—"}</span>
          </div>
          {buyerEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a
                href={`mailto:${buyerEmail}`}
                className="text-primary hover:underline truncate"
                data-testid="link-buyer-email"
              >
                {buyerEmail}
              </a>
            </div>
          )}
          {buyerPhone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a
                href={`tel:${buyerPhone}`}
                className="hover:underline"
                data-testid="link-buyer-phone"
              >
                {buyerPhone}
              </a>
            </div>
          )}
        </div>

        <div className="pt-1 border-t space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium">{packageLabel(order.package)}</span>
            {order.final_price != null && (
              <span className="text-muted-foreground">${order.final_price}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {paymentBadge(order.payment_status)}
          </div>
        </div>

        {order.report_delivered_at && (
          <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-2 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Report delivered</span>
          </div>
        )}

        <div className="pt-1">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={handleDeliverReport}
            disabled={delivering || !canDeliver}
            variant={alreadyDelivered ? "outline" : "default"}
            data-testid="button-deliver-report"
          >
            {delivering ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>
            ) : (
              <><Send className="h-3.5 w-3.5" />{alreadyDelivered ? "Resend Report" : "Send Report to Buyer"}</>
            )}
          </Button>
          {!canDeliver && !alreadyDelivered && (
            <p className="text-xs text-muted-foreground mt-1.5 text-center">
              Report must be QA-approved before delivery
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
