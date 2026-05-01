"use client";

import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Package, CreditCard, FileText, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminBuyerCardProps {
  order: Order;
}

function paymentBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800 border-green-200 no-default-hover-elevate no-default-active-elevate">Paid</Badge>;
    case "pending":
      return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-amber-700 border-amber-300 bg-amber-50">Pending</Badge>;
    case "refunded":
      return <Badge variant="destructive" className="no-default-hover-elevate no-default-active-elevate">Refunded</Badge>;
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

function packageLabel(pkg: string) {
  switch (pkg) {
    case "basic": return "Basic — $139";
    case "plus": return "Plus — $169";
    case "premium": return "Plus — $169";
    case "exotic": return "Exotic — $299";
    case "test": return "Internal Test — $1";
    default: return pkg;
  }
}

export function AdminBuyerCard({ order }: AdminBuyerCardProps) {
  const { toast } = useToast();

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

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
              {packageLabel(order.package)}
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
      </CardContent>
    </Card>
  );
}
