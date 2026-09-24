"use client";

import { useEffect, useState } from "react";
import type { JourneyOrder } from "@/lib/order-journey";

// Use the already-issued private tracking token; never look up an order by UUID alone.
export function useJourneyOrder(orderId: string | null, trackUrl: string | null, pollUntilPaid = false) {
  const [order, setOrder] = useState<JourneyOrder | null>(null);
  const [safeTrackUrl, setSafeTrackUrl] = useState<string | null>(null);

  useEffect(() => {
    setOrder(null);
    setSafeTrackUrl(null);
    if (!orderId || !trackUrl) return;
    let url: URL;
    try {
      url = new URL(trackUrl, window.location.origin);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin || url.pathname !== `/track/${orderId}`) return;
    const token = url.searchParams.get("t");
    if (!token) return;
    const path = `${url.pathname}?t=${encodeURIComponent(token)}`;
    setSafeTrackUrl(path);
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      fetch(`/api/orders/${encodeURIComponent(orderId)}/public-status?t=${encodeURIComponent(token)}`)
        .then(async (response) => {
          if (!response.ok) throw new Error("Order unavailable");
          return response.json();
        })
        .then((data) => {
          if (!active) return;
          setOrder(data.order);
          if (pollUntilPaid && data.order?.payment_status !== "paid" && ++attempts < 20) {
            timer = setTimeout(load, 3000);
          }
        })
        .catch(() => { if (active) setOrder(null); });
    };
    load();
    return () => { active = false; clearTimeout(timer); };
  }, [orderId, trackUrl, pollUntilPaid]);

  return { order, safeTrackUrl };
}