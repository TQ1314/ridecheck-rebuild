// app/track/[orderId]/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

type PublicOrder = {
  id: string;
  order_number: string | null;
  status: string | null;
  ops_status: string | null;
  created_at: string;
  preferred_date: string | null;
  package: string | null;
  booking_type: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_location: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Order received",
  new: "Order received",
  seller_contacted: "Contacting seller",
  seller_confirmed: "Seller confirmed",
  payment_requested: "Payment requested",
  payment_received: "Payment received",
  inspector_assigned: "Inspector assigned",
  scheduled: "Inspection scheduled",
  in_progress: "Inspection in progress",
  inspecting: "Inspection in progress",
  en_route: "Inspector en route",
  on_site: "Inspector on site",
  wrapping_up: "Wrapping up inspection",
  completed: "Inspection completed",
  pending_upload: "Report being prepared",
  uploaded: "Report under review",
  approved: "Report approved",
  delivered: "Report delivered",
  report_ready: "Report ready",
  cancelled: "Cancelled",
};

function friendlyStatus(raw?: string | null): string {
  if (!raw) return "Order received";
  const key = raw.toLowerCase().trim();
  return STATUS_LABELS[key] || raw.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function friendlyBookingType(raw?: string | null): string {
  if (!raw) return "Concierge";
  const map: Record<string, string> = {
    concierge: "Concierge",
    self_arranged: "Self-Arranged",
    buyer_arranged: "Buyer-Arranged",
  };
  return map[raw] || raw.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <TrackOrderInner />
    </Suspense>
  );
}

function TrackOrderInner() {
  const params = useParams();
  const search = useSearchParams();

  const orderId = params.orderId as string;
  const token = search.get("t") || "";

  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || !token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    const qs = new URLSearchParams();
    qs.set("t", token);

    fetch(`/api/orders/${orderId}/public-status?${qs.toString()}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to load order");
        return data;
      })
      .then((data) => {
        setOrder(data.order || null);
        setLoading(false);
      })
      .catch((e) => {
        setErr(e.message || "Unable to load order");
        setLoading(false);
      });
  }, [orderId, token]);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-bold text-lg" data-testid="link-home">
            RideCheck
          </Link>
          <Link href="/book" className="text-sm text-emerald-700 hover:underline" data-testid="link-book">
            Book an assessment
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold" data-testid="text-page-title">Order Status</h1>
            <p className="mt-1 text-sm text-gray-600">
              Keep this link. It&apos;s your private tracking page.
            </p>
          </div>
          <Link href="/" className="text-sm text-gray-700 hover:underline" data-testid="link-back-home">
            &larr; Home
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          {!token ? (
            <div data-testid="status-missing-token">
              <p className="font-semibold text-gray-800">Tracking token required</p>
              <p className="mt-2 text-sm text-gray-600">
                This tracking link is missing a token. Please use the full tracking link from your confirmation email.
              </p>
              <div className="mt-4">
                <Link href="/" className="text-sm text-emerald-700 hover:underline">
                  &larr; Back to RideCheck
                </Link>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-3" data-testid="status-loading">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <span className="text-sm text-gray-700">Loading your order&hellip;</span>
            </div>
          ) : err ? (
            <div data-testid="status-error">
              <p className="font-semibold text-red-700">Order not found</p>
              <p className="mt-2 text-sm text-gray-700">
                We couldn&apos;t find an order with that ID. Please double-check your tracking link.
              </p>
              <div className="mt-4">
                <Link href="/" className="text-sm text-emerald-700 hover:underline">
                  &larr; Back to RideCheck
                </Link>
              </div>
            </div>
          ) : !order ? (
            <div data-testid="status-not-found">
              <p className="font-semibold text-gray-800">Order not found</p>
              <p className="mt-2 text-sm text-gray-600">
                This order may not exist or the link may be incorrect.
              </p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="order-details">

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm text-gray-500">Order</div>
                  <div className="text-lg font-bold" data-testid="text-order-id">
                    {order.order_number || order.id}
                  </div>
                </div>

                <div className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-sm font-semibold text-emerald-800" data-testid="text-status-badge">
                  {friendlyStatus(order.ops_status || order.status)}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-600">Vehicle</div>
                  <div className="mt-1 text-sm font-semibold" data-testid="text-vehicle">
                    {[order.vehicle_year, order.vehicle_make, order.vehicle_model].filter(Boolean).join(" ") || "Not specified"}
                  </div>
                  {order.vehicle_location && (
                    <div className="mt-1 text-sm text-gray-700" data-testid="text-location">
                      {order.vehicle_location}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-600">Package</div>
                  <div className="mt-1 text-sm font-semibold" data-testid="text-package">
                    {(order.package || "standard").toUpperCase()}
                  </div>
                  <div className="mt-1 text-sm text-gray-700" data-testid="text-booking-type">
                    {friendlyBookingType(order.booking_type)}
                  </div>
                </div>
              </div>

              {order.preferred_date && (
                <div className="rounded-xl border bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-600">Preferred Date</div>
                  <div className="mt-1 text-sm font-semibold" data-testid="text-preferred-date">
                    {new Date(order.preferred_date).toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold">What happens next</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                  <li>Our team will contact the seller to confirm access &amp; scheduling.</li>
                  <li>You&apos;ll see status updates here as the order moves forward.</li>
                  <li>If we need anything from you, we&apos;ll email you.</li>
                </ul>
              </div>

              <div className="text-xs text-gray-500" data-testid="text-created-at">
                Created: {new Date(order.created_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
