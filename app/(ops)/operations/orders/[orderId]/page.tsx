"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Order, ActivityLogEntry, Profile } from "@/types/orders";
import { OrderDetailPanel } from "@/components/orders/OrderDetailPanel";
import { SellerContactPanel } from "@/components/orders/SellerContactPanel";
import { BuyerCard } from "@/components/orders/BuyerCard";
import { RideCheckerAssignmentPanel } from "@/components/orders/RideCheckerAssignmentPanel";
import { PayPanel } from "@/components/orders/PayPanel";
import { ReportPanel } from "@/components/orders/ReportPanel";
import { RiskFlagsPanel } from "@/components/orders/RiskFlagsPanel";
import { StatusUpdateDialog } from "@/components/orders/StatusUpdateDialog";
import { AssignOpsDialog } from "@/components/orders/AssignOpsDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  Loader2,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { canUpdateStatus, canAssignOps, canSendPayment, type Role } from "@/lib/utils/roles";
import { packageLabel } from "@/lib/utils/format";

const PACKAGE_OPTIONS = [
  { value: "standard", label: "Basic — $139" },
  { value: "plus",     label: "Plus — $169" },
  { value: "exotic",   label: "Exotic — $299" },
];

function formatAge(isoDate: string | undefined | null): { label: string; color: string } | null {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return { label: `${mins}m at this stage`, color: "text-green-700 bg-green-50 border-green-200" };
  if (hrs < 12)  return { label: `${hrs}h at this stage`, color: "text-green-700 bg-green-50 border-green-200" };
  if (hrs < 24)  return { label: `${hrs}h at this stage`, color: "text-amber-700 bg-amber-50 border-amber-200" };
  if (hrs < 48)  return { label: `${hrs}h at this stage`, color: "text-amber-700 bg-amber-50 border-amber-200" };
  const days = Math.floor(hrs / 24);
  return { label: `${days}d ${hrs % 24}h at this stage`, color: "text-red-700 bg-red-50 border-red-200" };
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending:       "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed:     "bg-blue-100 text-blue-800 border-blue-200",
    in_progress:   "bg-purple-100 text-purple-800 border-purple-200",
    completed:     "bg-green-100 text-green-800 border-green-200",
    delivered:     "bg-green-100 text-green-800 border-green-200",
    cancelled:     "bg-red-100 text-red-800 border-red-200",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <Badge className={cls} data-testid="badge-order-status">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export default function OpsOrderDetailPage() {
  const params  = useParams();
  const orderId = params.orderId as string;
  const supabase = createClient();
  const { toast } = useToast();

  const [order,      setOrder]      = useState<Order | null>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [loading,    setLoading]    = useState(true);

  const [overridePackage, setOverridePackage] = useState("");
  const [overrideReason,  setOverrideReason]  = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [sendingPayment,  setSendingPayment]  = useState(false);

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const [orderRes, activityRes, profileRes] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).single(),
      supabase
        .from("activity_log")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
    ]);

    if (orderRes.data)    setOrder(orderRes.data);
    if (activityRes.data) setActivities(activityRes.data);
    if (profileRes.data)  setProfile(profileRes.data);
    setLoading(false);
  }, [orderId]);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 45 s — surfaces RC acceptance / payment changes without manual reload
  useEffect(() => {
    const id = setInterval(loadData, 45_000);
    return () => clearInterval(id);
  }, [loadData]);

  /* ── Handlers ─────────────────────────────────────────────── */
  const handleStatusUpdate = async (newStatus: string) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Status updated" });
    loadData();
  };

  const handleAssign = async (opsId: string) => {
    const res = await fetch(`/api/orders/${orderId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_ops_id: opsId }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Order assigned" });
    loadData();
  };

  const handleSendPayment = async () => {
    setSendingPayment(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/send-payment`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Payment link sent" });
      loadData();
    } finally {
      setSendingPayment(false);
    }
  };

  const handlePackageOverride = async () => {
    if (!overridePackage) {
      toast({ title: "Select a package first", variant: "destructive" });
      return;
    }
    setOverrideLoading(true);
    const res = await fetch(`/api/ops/orders/${orderId}/package-override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package_override:        overridePackage,
        package_override_reason: overrideReason || null,
      }),
    });
    setOverrideLoading(false);
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Override failed", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Package overridden", description: `Set to ${packageLabel(overridePackage)}` });
    setOverridePackage("");
    setOverrideReason("");
    loadData();
  };

  /* ── Guards ───────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  const role       = (profile?.role || "operations") as Role;
  const canOverride = ["admin", "operations", "operations_lead", "owner"].includes(role);
  const vehicle    = [order.vehicle_year, order.vehicle_make, order.vehicle_model]
    .filter(Boolean).join(" ");

  const systemReason = order.classification_reason || "—";
  const isOverridden = systemReason.startsWith("[OPS OVERRIDE");

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/operations/orders">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="font-semibold text-lg leading-tight truncate"
                data-testid="heading-order-id"
              >
                {orderId.slice(0, 8).toUpperCase()}
              </h1>
              {statusBadge(order.status)}
              {order.ops_status && order.ops_status !== order.status && (
                <Badge variant="outline" className="text-xs">
                  {order.ops_status.replace(/_/g, " ")}
                </Badge>
              )}
              {(() => {
                const age = formatAge(order.updated_at);
                return age ? (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium border rounded px-1.5 py-0.5 ${age.color}`}
                    data-testid="badge-order-age"
                    title="Time since last status change"
                  >
                    <Clock className="h-3 w-3" />
                    {age.label}
                  </span>
                ) : null;
              })()}
            </div>
            {vehicle && (
              <p className="text-sm text-muted-foreground truncate">{vehicle}</p>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {canUpdateStatus(role) && (
            <StatusUpdateDialog
              orderId={orderId}
              currentStatus={order.status}
              onUpdate={handleStatusUpdate}
            />
          )}
          {canAssignOps(role) && (
            <AssignOpsDialog
              orderId={orderId}
              currentOpsId={order.assigned_ops_id}
              onAssign={handleAssign}
            />
          )}
          {canSendPayment(role) &&
            order.booking_type === "concierge" &&
            order.payment_status === "not_requested" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendPayment}
                disabled={sendingPayment}
                data-testid="button-send-payment"
              >
                {sendingPayment ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Payment Link
              </Button>
            )}
        </div>
      </div>

      {/* ── SLA timing strip ────────────────────────────────── */}
      {(() => {
        const milestones: { label: string; ts: string | null | undefined; warnHrs: number; critHrs: number }[] = [
          { label: "Paid",            ts: order.paid_at,                  warnHrs: 4,  critHrs: 24  },
          { label: "Assigned",        ts: order.assigned_at,              warnHrs: 2,  critHrs: 8   },
          { label: "Seller confirmed",ts: order.seller_confirmed_at,      warnHrs: 4,  critHrs: 12  },
          { label: "Inspected",       ts: order.inspection_completed_at,  warnHrs: 4,  critHrs: 24  },
          { label: "Report delivered",ts: order.report_delivered_at ?? order.report_sent_at, warnHrs: 2, critHrs: 6 },
        ].filter((m) => m.ts);
        if (milestones.length === 0) return null;
        return (
          <div className="flex items-center gap-2 flex-wrap" data-testid="strip-sla">
            {milestones.map((m) => {
              const hrs = Math.floor((Date.now() - new Date(m.ts!).getTime()) / 3_600_000);
              const cls =
                hrs >= m.critHrs ? "text-red-700 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800" :
                hrs >= m.warnHrs ? "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800" :
                "text-green-700 bg-green-50 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800";
              const display = hrs < 1
                ? `${Math.floor((Date.now() - new Date(m.ts!).getTime()) / 60_000)}m`
                : hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d`;
              return (
                <span key={m.label} className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5 ${cls}`}
                  data-testid={`sla-${m.label.replace(/\s/g, "-").toLowerCase()}`}>
                  <Clock className="h-3 w-3 shrink-0" />
                  {m.label}: <strong>{display} ago</strong>
                </span>
              );
            })}
          </div>
        );
      })()}

      {/* ── 2-column dashboard ──────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">
        {/* ── LEFT column ─────────────────────────────────── */}
        <div className="space-y-4">
          <OrderDetailPanel order={order} activities={activities} />
          <SellerContactPanel order={order} onRefresh={loadData} />
        </div>

        {/* ── RIGHT column ───────────────────────────────── */}
        <div className="space-y-4">
          <BuyerCard order={order} onRefresh={loadData} />
          <RideCheckerAssignmentPanel order={order} onRefresh={loadData} />
          <PayPanel order={order} onRefresh={loadData} />
          <ReportPanel order={order} onRefresh={loadData} />
          <RiskFlagsPanel order={order} onRefresh={loadData} />

          {/* Package Override */}
          {canOverride && (
            <Card data-testid="card-package-override">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Package Override
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    <span className="font-medium">Current: </span>
                    <span className="font-semibold">{packageLabel(order.package)}</span>
                    {order.base_price != null && (
                      <span className="ml-1">(${order.base_price})</span>
                    )}
                  </p>
                  <p>
                    <span className="font-medium">System reason: </span>
                    {isOverridden ? (
                      <span className="text-amber-600 dark:text-amber-400">{systemReason}</span>
                    ) : (
                      <span>{systemReason}</span>
                    )}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="override-pkg" className="text-xs">Force package to</Label>
                    <Select value={overridePackage} onValueChange={setOverridePackage}>
                      <SelectTrigger
                        id="override-pkg"
                        className="h-8 text-xs"
                        data-testid="select-override-package"
                      >
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {PACKAGE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="override-reason" className="text-xs">Reason (optional)</Label>
                    <Textarea
                      id="override-reason"
                      className="h-8 min-h-0 text-xs resize-none py-1.5"
                      placeholder="e.g. Confirmed EV, diesel, etc."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      data-testid="textarea-override-reason"
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePackageOverride}
                  disabled={overrideLoading || !overridePackage}
                  className="w-full"
                  data-testid="button-apply-override"
                >
                  {overrideLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</>
                  ) : (
                    "Apply Override"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
