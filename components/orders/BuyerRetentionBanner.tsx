"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, HelpCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Order, TransferableOrderCredit } from "@/types/orders";

interface BuyerRetentionBannerProps {
  order: Order;
}

export function BuyerRetentionBanner({ order }: BuyerRetentionBannerProps) {
  const [credit, setCredit] = useState<TransferableOrderCredit | null>(null);
  const [creditLoading, setCreditLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/buyer/orders/${order.id}/credit`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.credit) setCredit(d.credit); })
      .catch(() => {})
      .finally(() => setCreditLoading(false));
  }, [order.id]);

  if (order.seller_contact_status !== "declined") return null;

  const creditActive = credit?.status === "active" && new Date(credit.expires_at) > new Date();
  const creditDollars = credit ? (credit.remaining_amount_cents / 100).toFixed(2) : null;
  const expiryDate = credit
    ? new Date(credit.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3"
      data-testid="section-buyer-retention">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
            The seller declined inspection access.
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
            This does not automatically mean the vehicle has a problem — but many buyers consider a refusal
            an important signal before moving forward.
          </p>
        </div>
      </div>

      {!creditLoading && creditActive && (
        <div className="rounded-md bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-700 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <p className="text-sm font-semibold text-foreground">Your RideCheck is still active.</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Apply it to another vehicle instead of starting over — no new payment required for the same package.
          </p>
          {creditDollars && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" data-testid="badge-credit-amount">
                Credit: ${creditDollars}
              </Badge>
              {expiryDate && (
                <span className="text-xs text-muted-foreground" data-testid="text-credit-expiry">
                  Expires {expiryDate}
                </span>
              )}
            </div>
          )}
          <Link href={`/orders/${order.id}/transfer`}>
            <Button className="gap-2 mt-1" data-testid="button-inspect-another">
              <RefreshCw className="h-4 w-4" />
              Inspect Another Vehicle
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      {!creditLoading && credit && credit.status === "used" && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground" data-testid="section-credit-used">
          Your RideCheck credit was already applied to a new vehicle.{" "}
          {credit.used_order_id && (
            <Link href={`/orders/${credit.used_order_id}`} className="text-primary underline">
              View new order
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200 dark:border-amber-700">
        <Link href={`/orders`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" data-testid="button-contact-ops">
            <HelpCircle className="h-3.5 w-3.5" />
            Contact Ops for Help
          </Button>
        </Link>
      </div>
    </div>
  );
}
