"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Home, MessageSquare, RefreshCw, Copy, Check } from "lucide-react";
import { isMarketplaceConcierge, isSelfArranged, publicOrderReference, sellerIntroduction, SELF_ARRANGE_MESSAGE, isFacebookBuyerHandoff } from "@/lib/order-journey";
import { FACEBOOK_CONTACT_EXPLANATION, FACEBOOK_SELLER_MESSAGE } from "@/lib/seller-contact/facebook-marketplace";
import { useJourneyOrder } from "@/lib/use-journey-order";

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
  const { order, safeTrackUrl } = useJourneyOrder(orderId, trackUrl, status === "paid");

  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isPaid = status === "paid" && order?.payment_status === "paid";
  const paymentProcessing = status === "paid" && !isPaid;
  const selfArrange = isSelfArranged(order?.booking_type);
  const showIntroduction = isPaid && !!order && isMarketplaceConcierge(order);
  const facebookHandoff = isFacebookBuyerHandoff(order);
  const sellerMessage = facebookHandoff ? FACEBOOK_SELLER_MESSAGE : showIntroduction ? sellerIntroduction(order) : SELF_ARRANGE_MESSAGE;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sellerMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = sellerMessage;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
               {isPaid ? "Payment Confirmed!" : paymentProcessing ? "Payment Processing" : "Order Received!"}
            </h1>
            {publicOrderReference(order?.order_number) && (
              <p className="text-sm text-muted-foreground mb-4 font-semibold" data-testid="text-order-id">
                {publicOrderReference(order?.order_number)}
              </p>
            )}

            {isPaid ? (
              <p className="text-muted-foreground mb-6" data-testid="text-paid-message">
                {!order
                  ? "Your payment has been confirmed. Track your order for the next steps."
                  : selfArrange
                  ? "Your payment is confirmed. You coordinate access and timing with the seller; share the details with RideCheck."
                  : <>You&apos;re all set. We&apos;ll take it from here. RideCheck will coordinate with the seller, arrange access to the vehicle, assign a RideChecker, and keep you updated.</>}
              </p>
            ) : paymentProcessing ? (
              <p className="text-muted-foreground mb-6">We&apos;re confirming your payment. RideCheck will not contact the seller or schedule the inspection until payment is confirmed. Track your order for updates.</p>
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

            {(selfArrange || showIntroduction) && <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-5 text-left mb-6 border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                {facebookHandoff ? "Facebook Marketplace seller contact" : selfArrange ? "Coordinate access with the seller" : "Introduce RideCheck to the seller"}
              </p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70 mb-3">
                {facebookHandoff ? `${FACEBOOK_CONTACT_EXPLANATION} Your reported agreement is not an independently confirmed appointment.` : selfArrange
                  ? "You coordinate access and timing with the seller. Share the confirmed details with RideCheck."
                  : "If you're already messaging the seller, send this quick introduction. After that, RideCheck handles the coordination. This is optional."}
              </p>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4 text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed" data-testid="text-seller-message">
                {sellerMessage}
              </div>
              <button
                onClick={handleCopy}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 transition-colors"
                data-testid="button-copy-seller-message"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Message
                  </>
                )}
              </button>
            </div>}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {safeTrackUrl && (
                <Link href={safeTrackUrl}>
                  <Button variant="default" data-testid="button-track-order">
                    Track Your Order
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
