"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function OrderReceivedPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-lg px-4 sm:px-6">
        <Card>
          <CardContent className="pt-10 pb-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Order Received!</h1>
            {orderId && (
              <p className="font-mono text-sm text-muted-foreground mb-4" data-testid="text-order-id">
                Order ID: {orderId}
              </p>
            )}
            <p className="text-muted-foreground mb-8">
              Your inspection order has been submitted successfully.
              You&apos;ll receive a confirmation email shortly with the next steps.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {orderId && (
                <Link href={`/orders/${orderId}`}>
                  <Button data-testid="button-view-order">
                    View Order
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link href="/dashboard">
                <Button variant="outline" data-testid="button-go-dashboard">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
