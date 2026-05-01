"use client";

import { useState } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Package, CreditCard, FileText, Copy, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminBuyerCardProps {
  order: Order;
  onRefresh?: () => void;
}

function paymentBadge(status: string) {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 no-default-hover-elevate no-default-active-elevate">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case "pending":
      return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-amber-700 border-amber-300 bg-amber-50">Payment Pending</Badge>;
    case "requested":
      return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-amber-700 border-amber-300 bg-amber-50">Awaiting Payment</Badge>;
    case "unpaid":
      return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-amber-700 border-amber-300 bg-amber-50">Awaiting Payment</Badge>;
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 no-default-hover-elevate no-default-active-elevate">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "refunded":
      return <Badge variant="destructive" className="no-default-hover-elevate no-default-active-elevate">Refunded</Badge>;
    case "not_requested":
      return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-muted-foreground">Not Requested</Badge>;
    default:
      return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">{status || "Unknown"}</Badge>;
  }
}

function reportBadge(status: string | undefined) {
  if (!status) return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">No Report</Badge>;
  switch (status) {
    case "delivered":
    case "sent":
      return <Badge className="bg-green-100 text-green-800 border-green-200 no-default-hover-elevate no-default-active-elevate text-xs">Delivered</Badge>;
    case "approved":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 no-default-hover-elevate no-default-active-elevate text-xs">Ready to Send</Badge>;
    case "draft":
      return <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">Draft</Badge>;
    case "in_review":
      return <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">In Review</Badge>;
    default:
      return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">{status}</Badge>;
  }
}

function pkgLabel(pkg: string) {
  switch (pkg) {
    case "basic": return "Basic — $139";
    case "plus": return "Plus — $169";
    case "premium": return "Plus — $169";
    case "exotic": return "Exotic — $299";
    case "test": return "Internal Test — $1";
    default: return pkg;
  }
}

const UNPAID_STATES = ["unpaid", "pending", "requested", "failed", "not_requested"];

export function AdminBuyerCard({ order, onRefresh }: AdminBuyerCardProps) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const syncPayment = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/sync-payment`, { method: "POST" });
      const data = await res.json();
      if (data.synced) {
        toast({
          title: "Payment synced",
          description: "Order updated to Paid via Stripe verification.",
        });
        onRefresh?.();
      } else if (data.already_paid) {
        toast({ title: "Already paid", description: "Order is already marked as paid." });
        onRefresh?.();
      } else {
        toast({
          title: "Not paid on Stripe",
          description: data.message || "Stripe does not show this payment as complete.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Sync failed", description: "Could not reach Stripe. Try again.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const isPaid = order.payment_status === "paid";
  const showSyncButton = UNPAID_STATES.includes(order.payment_status);

  return (
    <Card data-testid="card-buyer-info">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Buyer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-semibold text-sm truncate" data-testid="text-buyer-name">
                {order.customer_name || "—"}
              </span>
            </div>
          </div>

          {order.customer_email && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate" data-testid="text-buyer-email">
                  {order.customer_email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => copy(order.customer_email, "Email")}
                data-testid="button-copy-buyer-email"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}

          {order.customer_phone && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground" data-testid="text-buyer-phone">
                  {order.customer_phone}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => copy(order.customer_phone!, "Phone")}
                data-testid="button-copy-buyer-phone"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="border-t pt-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Package</span>
            </div>
            <span className="text-xs font-medium" data-testid="text-buyer-package">
              {pkgLabel(order.package)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Payment</span>
            </div>
            <span data-testid="badge-payment-status">
              {paymentBadge(order.payment_status)}
            </span>
          </div>

          {order.paid_at && isPaid && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground pl-5">Paid at</span>
              <span className="text-xs text-muted-foreground" data-testid="text-paid-at">
                {new Date(order.paid_at).toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Report</span>
            </div>
            <span data-testid="badge-report-status">
              {reportBadge(order.report_status)}
            </span>
          </div>
        </div>

        {showSyncButton && (
          <div className="border-t pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5"
              onClick={syncPayment}
              disabled={syncing}
              data-testid="button-sync-payment"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Checking Stripe…" : "Sync Payment from Stripe"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              Queries Stripe directly and updates order if paid
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
