"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Home, MessageSquare, RefreshCw } from "lucide-react";

export default function OrderReceivedPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <OrderReceivedInner />
    </Suspense>
  );
}

function OrderReceivedInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const trackUrl = searchParams.get("track");
  const status = searchParams.get("status");

  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<string | null>(null);

  const isPaid = status === "paid";

  const handleResend = async () => {
    if (!orderId) return;
    setResending(true);
    setResendResult(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/send-payment-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to resend");
      setResendResult(
        data.channel === "sms"
          ? "Payment link sent to your phone!"
          : "Payment link sent to your email!"
      );
    } catch (e: any) {
      setResendResult(e.message || "Could not resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-lg px-4 sm:px-6">
        <Card>
          <CardContent className="pt-10 pb-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2" data-testid="text-page-title">
              {isPaid ? "Payment Confirmed!" : "Order Received!"}
            </h1>
            {orderId && (
              <p className="font-mono text-sm text-muted-foreground mb-4" data-testid="text-order-id">
                Order ID: {orderId}
              </p>
            )}

            {isPaid ? (
              <p className="text-muted-foreground mb-6" data-testid="text-paid-message">
                Your payment has been received. Our team is on it — you&apos;ll hear from us soon.
              </p>
            ) : (
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4 text-left">
                  <MessageSquare className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300" data-testid="text-sms-sent">
                      We just texted you a secure payment link to confirm your inspection.
                    </p>
                    <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-1">
                      Check your phone for a message from RideCheck.
                    </p>
                  </div>
                </div>

                {orderId && (
                  <div className="text-center">
                    <button
                      onClick={handleResend}
                      disabled={resending}
                      className="text-sm text-emerald-700 hover:underline inline-flex items-center gap-1.5 disabled:opacity-50"
                      data-testid="button-resend-link"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                      {resending ? "Resending..." : "Didn\u2019t get it? Resend link"}
                    </button>
                    {resendResult && (
                      <p className="text-xs text-muted-foreground mt-1" data-testid="text-resend-result">
                        {resendResult}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {trackUrl && (
                <Link href={trackUrl}>
                  <Button variant={isPaid ? "default" : "outline"} data-testid="button-track-order">
                    Track Order
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link href="/">
                <Button variant="outline" data-testid="button-go-home">
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
