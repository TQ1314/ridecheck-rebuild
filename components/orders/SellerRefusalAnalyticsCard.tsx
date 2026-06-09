"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { XCircle, RefreshCw, DollarSign } from "lucide-react";
import type { Order, TransferableOrderCredit } from "@/types/orders";
import Link from "next/link";

interface SellerRefusalAnalyticsCardProps {
  order: Order;
}

export function SellerRefusalAnalyticsCard({ order }: SellerRefusalAnalyticsCardProps) {
  const [credit, setCredit] = useState<TransferableOrderCredit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (order.seller_contact_status !== "declined") {
      setLoading(false);
      return;
    }
    // Ops fetches credit via admin API — reuse the buyer credit endpoint with service-role fallback
    fetch(`/api/ops/orders/${order.id}/seller-refusal-analytics`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.credit) setCredit(d.credit); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [order.id, order.seller_contact_status]);

  if (order.seller_contact_status !== "declined") return null;

  const creditDollars = credit ? (credit.remaining_amount_cents / 100).toFixed(2) : null;
  const creditStatus = credit?.status ?? "unknown";
  const buyerTransferred = credit?.status === "used";
  const creditActive = credit?.status === "active";

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "active") return "default";
    if (s === "used") return "secondary";
    if (s === "expired" || s === "refunded") return "destructive";
    return "outline";
  };

  return (
    <Card className="border-red-200 dark:border-red-800" data-testid="card-seller-refusal">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
          <XCircle className="h-4 w-4" />
          Seller Refusal Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Seller refused</span>
          <Badge variant="destructive" className="text-[10px]">Yes</Badge>
        </div>

        {order.seller_outcome_notes && (
          <div className="flex justify-between items-start gap-4">
            <span className="text-muted-foreground shrink-0">Reason/notes</span>
            <span className="text-right text-foreground">{order.seller_outcome_notes}</span>
          </div>
        )}

        {order.platform_source && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Platform</span>
            <span className="font-medium capitalize">{order.platform_source}</span>
          </div>
        )}

        {order.listing_source && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Source</span>
            <span className="font-medium capitalize">{String(order.listing_source).replace(/_/g, " ")}</span>
          </div>
        )}

        <div className="border-t pt-2 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Credit created
            </span>
            {loading ? (
              <span className="text-muted-foreground">Loading…</span>
            ) : credit ? (
              <Badge variant="outline" className="text-[10px]">
                ${creditDollars}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">None</Badge>
            )}
          </div>

          {!loading && credit && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Credit status</span>
                <Badge variant={statusVariant(creditStatus)} className="text-[10px]">
                  {creditStatus}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Buyer retained via transfer
                </span>
                <Badge variant={buyerTransferred ? "default" : "outline"} className="text-[10px]">
                  {buyerTransferred ? "Yes" : creditActive ? "Not yet" : "No"}
                </Badge>
              </div>

              {buyerTransferred && credit.used_order_id && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">New order</span>
                  <Link
                    href={`/operations/orders/${credit.used_order_id}`}
                    className="text-primary hover:underline text-[10px]"
                    data-testid="link-new-order"
                  >
                    View →
                  </Link>
                </div>
              )}

              {credit.expires_at && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Credit expires</span>
                  <span className="text-foreground">
                    {new Date(credit.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
