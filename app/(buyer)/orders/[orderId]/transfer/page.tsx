"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import type { Order, TransferableOrderCredit } from "@/types/orders";

export default function TransferRideCheckPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const supabase = createClient();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [credit, setCredit] = useState<TransferableOrderCredit | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    new_listing_url: "",
    new_vehicle_year: new Date().getFullYear(),
    new_vehicle_make: "",
    new_vehicle_model: "",
    new_vehicle_trim: "",
    new_vehicle_location: "",
    new_seller_name: "",
    new_seller_phone: "",
    new_seller_email: "",
    seller_type: "",
  });

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("customer_id", session.user.id)
        .single();

      if (orderData) {
        setOrder(orderData);
        const res = await fetch(`/api/buyer/orders/${orderId}/credit`);
        if (res.ok) {
          const d = await res.json();
          setCredit(d.credit ?? null);
        }
      }
      setLoading(false);
    }
    load();
  }, [orderId]);

  const handleSubmit = async () => {
    if (!form.new_vehicle_make || !form.new_vehicle_model || !form.new_vehicle_location) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/buyer/orders/${orderId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          new_vehicle_year: Number(form.new_vehicle_year),
          new_listing_url: form.new_listing_url || undefined,
          new_seller_email: form.new_seller_email || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Failed to transfer", variant: "destructive" });
        return;
      }
      setSuccess(data.new_order_id);
      toast({ title: "RideCheck transferred successfully!" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Order not found.</p>
        <Link href="/orders"><Button variant="outline" className="mt-4">Back to Orders</Button></Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-6">
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-6 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
          <h2 className="text-xl font-semibold">RideCheck Transferred!</h2>
          <p className="text-sm text-muted-foreground">Your RideCheck has been applied to the new vehicle. No additional payment required.</p>
          <Link href={`/orders/${success}`}>
            <Button className="mt-2" data-testid="button-view-new-order">View New Order</Button>
          </Link>
        </div>
      </div>
    );
  }

  const creditActive = credit?.status === "active" && new Date(credit.expires_at) > new Date();
  const creditDollars = credit ? (credit.remaining_amount_cents / 100).toFixed(2) : null;

  if (!creditActive) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <Link href={`/orders/${orderId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        </Link>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-200">Transfer not available</p>
              <p className="text-sm text-muted-foreground mt-1">
                {credit ? `Credit is ${credit.status}.` : "No active credit found."}{" "}
                Contact our support team for help.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <Link href={`/orders/${orderId}`}>
        <Button variant="ghost" size="sm" data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
      </Link>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Inspect Another Vehicle
        </h1>
        <p className="text-sm text-muted-foreground">
          Apply your existing RideCheck to a new listing — no new payment needed for the same package.
        </p>
      </div>

      {/* Credit status */}
      <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between text-sm">
        <div>
          <span className="font-medium">Available Credit</span>
          <Badge variant="outline" className="ml-2">${creditDollars}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          Expires {new Date(credit!.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {/* Original vehicle context */}
      <div className="text-xs text-muted-foreground">
        Original order: {order.vehicle_year} {order.vehicle_make} {order.vehicle_model} — seller declined inspection.
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">New Vehicle Details</CardTitle>
          <CardDescription className="text-xs">Enter the vehicle you'd like to inspect instead.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Listing URL (optional)</Label>
            <Input
              placeholder="https://..."
              value={form.new_listing_url}
              onChange={(e) => setForm((p) => ({ ...p, new_listing_url: e.target.value }))}
              data-testid="input-new-listing-url"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Year <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={1990}
                max={2030}
                value={form.new_vehicle_year}
                onChange={(e) => setForm((p) => ({ ...p, new_vehicle_year: Number(e.target.value) }))}
                data-testid="input-new-year"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Make <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Toyota"
                value={form.new_vehicle_make}
                onChange={(e) => setForm((p) => ({ ...p, new_vehicle_make: e.target.value }))}
                data-testid="input-new-make"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Model <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Camry"
                value={form.new_vehicle_model}
                onChange={(e) => setForm((p) => ({ ...p, new_vehicle_model: e.target.value }))}
                data-testid="input-new-model"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Vehicle Location <span className="text-destructive">*</span></Label>
            <Input
              placeholder="City, State or address"
              value={form.new_vehicle_location}
              onChange={(e) => setForm((p) => ({ ...p, new_vehicle_location: e.target.value }))}
              data-testid="input-new-location"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Seller Phone</Label>
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={form.new_seller_phone}
                onChange={(e) => setForm((p) => ({ ...p, new_seller_phone: e.target.value }))}
                data-testid="input-new-seller-phone"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Seller Email</Label>
              <Input
                type="email"
                placeholder="seller@example.com"
                value={form.new_seller_email}
                onChange={(e) => setForm((p) => ({ ...p, new_seller_email: e.target.value }))}
                data-testid="input-new-seller-email"
              />
            </div>
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="button-submit-transfer"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {submitting ? "Transferring…" : "Apply RideCheck to New Vehicle"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
