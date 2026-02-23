// app/track/[orderId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

function statusLabel(v?: string | null) {
  const s = (v || "").replace(/_/g, " ").trim();
  if (!s) return "Submitted";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function TrackOrderPage() {
  const params = useParams();
  const search = useSearchParams();

  const orderId = params.orderId as string;
  const token = search.get("t") || "";

  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const apiUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (token) qs.set("t", token);
    return `/api/orders/${orderId}/public-status?${qs.toString()}`;
  }, [orderId, token]);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setErr(null);

    fetch(apiUrl)
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
  }, [apiUrl, orderId]);

  if (!token) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <h1 className="text-2xl font-extrabold">Track your RideCheck order</h1>
          <p className="mt-3 text-gray-700">
            This link is missing a tracking token. Please use the tracking link from your confirmation page/email.
          </p>
          <div className="mt-6">
            <Link className="text-emerald-700 hover:underline" href="/">
              ← Back to RideCheck
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-bold">
            RideCheck
          </Link>
          <Link href="/book" className="text-sm text-emerald-700 hover:underline">
            Book another inspection
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold">Order Status</h1>
            <p className="mt-1 text-sm text-gray-600">
              Keep this link. It’s your private tracking page.
            </p>
          </div>

          <Link href="/" className="text-sm text-gray-700 hover:underline">
            ← Home
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <span className="text-sm text-gray-700">Loading your order…</span>
            </div>
          ) : err ? (
            <div>
              <p className="font-semibold text-red-700">Couldn’t load order</p>
              <p className="mt-2 text-sm text-gray-700">{err}</p>
            </div>
          ) : !order ? (
            <p className="text-sm text-gray-700">Order not found.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm text-gray-500">Order</div>
                  <div className="text-lg font-bold">
                    {order.order_number || order.id}
                  </div>
                </div>

                <div className="rounded-full border px-3 py-1 text-sm font-semibold">
                  {statusLabel(order.ops_status || order.status)}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-600">Vehicle</div>
                  <div className="mt-1 text-sm font-semibold">
                    {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
                  </div>
                  <div className="mt-1 text-sm text-gray-700">{order.vehicle_location}</div>
                </div>

                <div className="rounded-xl border bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-600">Package</div>
                  <div className="mt-1 text-sm font-semibold">
                    {(order.package || "standard").toString().toUpperCase()}
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    Booking: {statusLabel(order.booking_type)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold">What happens next</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                  <li>Ops will contact the seller to confirm access & scheduling.</li>
                  <li>You’ll see status updates here as the order moves forward.</li>
                  <li>If we need anything from you, we’ll email you.</li>
                </ul>
              </div>

              <div className="text-xs text-gray-500">
                Created: {new Date(order.created_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}