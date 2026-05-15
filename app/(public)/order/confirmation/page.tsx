"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, Copy, Check, MessageSquare, Mail, Car } from "lucide-react";

const SELLER_MESSAGE = `Hi! Before I drive out to see the car, I usually have a mobile RideCheck inspector take a quick look. It takes about 30–45 minutes and helps me move fast if everything checks out. Would that be okay with you?`;

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <OrderConfirmationInner />
    </Suspense>
  );
}

function OrderConfirmationInner() {
  const searchParams = useSearchParams();

  const orderId = searchParams.get("order_id");
  const method = searchParams.get("method") || "concierge";
  const trackUrl = searchParams.get("track") || null;

  const isSelfArrange = method === "self_arrange" || method === "buyer_arranged";

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SELLER_MESSAGE);
    } catch {
      const el = document.createElement("textarea");
      el.value = SELLER_MESSAGE;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">

        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Order Received!</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your RideCheck inspection request has been submitted successfully.
          </p>
          {orderId && (
            <p className="text-xs text-muted-foreground mt-3 font-mono" data-testid="text-order-id">
              Order ID: {orderId}
            </p>
          )}
        </div>

        <div className="space-y-5">

          <Card data-testid="card-check-email">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Check Your Email &amp; Phone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>We just sent you:</p>
              <ul className="space-y-1 pl-4">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span><strong className="text-foreground">Email</strong> — order confirmation with your full summary</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span><strong className="text-foreground">Text</strong> — a secure payment link to your phone</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span><strong className="text-foreground">Seller script</strong> — the message below is also in your email</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20" data-testid="card-seller-script">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-green-700 dark:text-green-400" />
                    Message to Send the Seller
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isSelfArrange
                      ? "Send this to the seller now to confirm the inspector is coming."
                      : "Send this heads-up to the seller — it improves scheduling success and reduces refusals."}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-green-700 border-green-300 dark:text-green-400 dark:border-green-700 shrink-0 text-xs"
                >
                  {isSelfArrange ? "Action needed" : "Recommended"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="bg-white dark:bg-background border border-border rounded-md p-4 text-sm leading-relaxed italic text-foreground mb-3"
                data-testid="text-seller-message"
              >
                {SELLER_MESSAGE}
              </div>
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="gap-2"
                data-testid="button-copy-seller-message"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy message
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Paste into your text thread, Facebook Messenger, email — however you&apos;re talking with the seller.
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-next-steps">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                What Happens Next
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium">Complete payment</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Tap the secure link we texted and emailed you to pay for the inspection.</p>
                  </div>
                </li>
                {isSelfArrange ? (
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                    <div>
                      <p className="font-medium">Confirm with the seller</p>
                      <p className="text-muted-foreground text-xs mt-0.5">Use the message above to let the seller know an inspector will be coming.</p>
                    </div>
                  </li>
                ) : (
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                    <div>
                      <p className="font-medium">We contact the seller</p>
                      <p className="text-muted-foreground text-xs mt-0.5">Our team reaches out to schedule the inspection at a time that works for everyone.</p>
                    </div>
                  </li>
                )}
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                  <div>
                    <p className="font-medium">Inspector goes to the vehicle</p>
                    <p className="text-muted-foreground text-xs mt-0.5">A certified RideChecker conducts the on-site assessment.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                  <div>
                    <p className="font-medium">Intelligence report delivered to your email</p>
                    <p className="text-muted-foreground text-xs mt-0.5">You&apos;ll get a full RideCheck report to help you decide with confidence.</p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {trackUrl && (
              <Link href={trackUrl} className="flex-1" data-testid="link-track-order">
                <Button variant="outline" className="w-full gap-2">
                  Track Your Order
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href="/" className="flex-1" data-testid="link-back-home">
              <Button variant="ghost" className="w-full">
                Back to Home
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
