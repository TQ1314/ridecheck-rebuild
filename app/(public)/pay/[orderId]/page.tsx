"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { formatCurrency } from "@/lib/utils/pricing";
import { LEGAL_SUMMARY_BULLETS, TERMS_VERSION } from "@/lib/legal/constants";

interface PayOrderSummary {
  id: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  booking_type: string;
  package: string;
  buyer_email?: string;
}

export default function PayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <PayInner />
    </Suspense>
  );
}

function PayInner() {
  const params = useParams();
  const search = useSearchParams();
  const orderId = params.orderId as string;
  const token = search.get("t") || "";

  const [order, setOrder] = useState<PayOrderSummary | null>(null);
  const [price, setPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!orderId || !token) {
      setLoading(false);
      return;
    }

    fetch(`/api/pay/validate?orderId=${orderId}&t=${token}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (data.paid) {
          setAlreadyPaid(true);
          setLoading(false);
          return;
        }
        if (!r.ok || !data.valid) {
          throw new Error(data?.error || "Invalid payment link");
        }
        setOrder(data.order);
        setPrice(data.price);
        setLoading(false);
      })
      .catch((e) => {
        setErr(e.message || "Unable to validate payment link");
        setLoading(false);
      });
  }, [orderId, token]);

  const handlePay = async () => {
    if (!termsAccepted) return;
    setPaying(true);
    try {
      await fetch(`/api/orders/${orderId}/accept-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted: true,
          buyerEmail: order?.buyer_email || undefined,
          userAgent: navigator.userAgent,
        }),
      });

      const res = await fetch("/api/pay/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create payment");
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      setErr(e.message || "Payment failed");
      setPaying(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-bold text-lg" data-testid="link-home">
            RideCheck
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-16">
        {!token ? (
          <Card>
            <CardContent className="pt-8 pb-6 text-center">
              <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2" data-testid="text-missing-token">Payment link required</h1>
              <p className="text-sm text-gray-600">
                Please use the secure payment link we sent to your phone or email.
              </p>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center justify-center min-h-[200px]" data-testid="status-loading">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : alreadyPaid ? (
          <Card>
            <CardContent className="pt-8 pb-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2" data-testid="text-already-paid">Payment Complete</h1>
              <p className="text-sm text-gray-600 mb-4">This order has already been paid. Thank you!</p>
              <Link href="/">
                <Button variant="outline" data-testid="button-go-home">Back to RideCheck</Button>
              </Link>
            </CardContent>
          </Card>
        ) : err ? (
          <Card>
            <CardContent className="pt-8 pb-6 text-center">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2" data-testid="text-error">Something went wrong</h1>
              <p className="text-sm text-gray-600">{err}</p>
            </CardContent>
          </Card>
        ) : order ? (
          <Card>
            <CardContent className="pt-8 pb-6">
              <div className="text-center mb-6">
                <div className="mx-auto mb-3 w-10"><Logo size={40} /></div>
                <h1 className="text-xl font-bold" data-testid="text-page-title">Confirm Your Inspection</h1>
                <p className="text-sm text-gray-600 mt-1">Secure payment powered by Stripe</p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Vehicle</span>
                  <span className="font-medium" data-testid="text-vehicle">
                    {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Package</span>
                  <span className="font-medium capitalize" data-testid="text-package">{order.package}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg text-emerald-700" data-testid="text-price">
                    {formatCurrency(price)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-5" data-testid="section-legal-summary">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800">Inspection Scope &amp; Terms ({TERMS_VERSION})</span>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {LEGAL_SUMMARY_BULLETS.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="mt-0.5 shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <label
                  className="flex items-start gap-3 cursor-pointer"
                  data-testid="label-terms-checkbox"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-emerald-600"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    data-testid="checkbox-terms-accept"
                  />
                  <span className="text-xs text-gray-700 leading-snug">
                    I have read and agree to the RideCheck inspection scope and terms above. I understand this is a visual, non-invasive assessment and the final purchase decision is mine.
                  </span>
                </label>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handlePay}
                disabled={paying || !termsAccepted}
                data-testid="button-pay-now"
              >
                {paying ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Pay {formatCurrency(price)}
                  </span>
                )}
              </Button>

              {!termsAccepted && (
                <p className="text-xs text-center text-amber-600 mt-2" data-testid="text-terms-required">
                  Please accept the terms above to continue
                </p>
              )}

              <p className="text-xs text-center text-gray-500 mt-3">
                You&apos;ll be redirected to Stripe for secure payment
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
