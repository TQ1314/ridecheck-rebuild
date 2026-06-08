"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderEvent, AuditLogEntry, ActivityLogEntry } from "@/types/orders";
import { OrderDetailPanel } from "@/components/orders/OrderDetailPanel";
import { SellerContactPanel } from "@/components/orders/SellerContactPanel";
import { OpsReportBuilderPanel } from "@/components/orders/OpsReportBuilderPanel";
import { AdminBuyerCard } from "@/components/orders/AdminBuyerCard";
import { NextActionPanel } from "@/components/orders/NextActionPanel";
import { StatusUpdateDialog } from "@/components/orders/StatusUpdateDialog";
import { Button } from "@/components/ui/button";
import { formatOrderCode } from "@/lib/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  RefreshCw,
  UserPlus,
  CreditCard,
  Clock,
  Shield,
  Send,
  FileCheck,
  Loader2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { formatRelative, statusLabel, formatEventDetails } from "@/lib/utils/format";
import { VehicleInfoEditPanel } from "@/components/orders/VehicleInfoEditPanel";

const OPS_STATUSES = [
  "new",
  "seller_outreach",
  "seller_confirmed",
  "payment_pending",
  "payment_received",
  "contact_seller",
  "needs_buyer_info",
  "inspector_assigned",
  "scheduled",
  "in_progress",
  "report_drafting",
  "report_review",
  "delivered",
  "completed",
  "on_hold",
  "cancelled",
];

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [assignedRc, setAssignedRc] = useState<any>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [attemptCount, setAttemptCount] = useState(0);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [opsStatusOpen, setOpsStatusOpen] = useState(false);
  const [opsStatus, setOpsStatus] = useState("");
  const [opsNotes, setOpsNotes] = useState("");
  const [opsLoading, setOpsLoading] = useState(false);

  const [assignRcOpen, setAssignRcOpen] = useState(false);
  const [rcSuggestions, setRcSuggestions] = useState<any[]>([]);
  const [selectedRc, setSelectedRc] = useState("");
  const [assignRcLoading, setAssignRcLoading] = useState(false);

  async function loadData() {
    const res = await fetch(`/api/admin/orders/${orderId}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    if (data.order) {
      setOrder(data.order);
      setOpsStatus(data.order.ops_status || "new");
      // Pre-populate attempt count from order counter for NextActionPanel
      setAttemptCount(data.order.seller_contact_attempts ?? 0);
    }
    if (data.events) setEvents(data.events);
    if (data.audit) setAudit(data.audit);
    if (data.inspector) setAssignedRc(data.inspector);
    if (data.activities) setActivities(data.activities);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [orderId]);

  // Fetch current user role for permission-gated UI
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile?.role) setCurrentUserRole(profile.role);
    });
  }, []);

  useEffect(() => {
    if (assignRcOpen && order) {
      const area = order.vehicle_location || order.inspection_address || "";
      fetch(`/api/admin/ridecheckers/suggest?area=${encodeURIComponent(area)}&orderId=${orderId}`)
        .then((r) => r.json())
        .then((data) => setRcSuggestions(data.suggestions || []))
        .catch(() => setRcSuggestions([]));
    }
  }, [assignRcOpen, order, orderId]);

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

  const handleOpsStatusUpdate = async () => {
    setOpsLoading(true);
    const res = await fetch(`/api/admin/orders/${orderId}/ops-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops_status: opsStatus, notes: opsNotes || undefined }),
    });
    setOpsLoading(false);
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Ops status updated" });
    setOpsStatusOpen(false);
    setOpsNotes("");
    loadData();
  };

  const handleAssignRidechecker = async () => {
    if (!selectedRc) return;
    setAssignRcLoading(true);
    // Use the ridechecker-assign route so assignment row + notifications are created properly
    const res = await fetch(`/api/ops/orders/${orderId}/ridechecker-assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ridechecker_id: selectedRc }),
    });
    setAssignRcLoading(false);
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "RideChecker assigned — they have 15 min to accept" });
    setAssignRcOpen(false);
    loadData();
  };

  const handleRequestPayment = async () => {
    const res = await fetch(`/api/admin/orders/${orderId}/request-payment`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Payment requested" });
    loadData();
  };

  const [deliverLoading, setDeliverLoading] = useState(false);

  const handleDeliverReport = async () => {
    setDeliverLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/deliver-report`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Report delivered to customer" });
      loadData();
    } catch {
      toast({ title: "Delivery failed", variant: "destructive" });
    } finally {
      setDeliverLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Top bar: back + title + status badges */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Orders
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-semibold leading-tight">{vehicleLabel}</h1>
            <p className="text-xs text-muted-foreground font-mono">{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate" data-testid="badge-ops-status">
            Stage: {statusLabel(order.ops_status || "new")}
          </Badge>
          {assignedRc && (
            <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate" data-testid="badge-ridechecker">
              RC: {assignedRc.full_name}
            </Badge>
          )}
          {order.report_status && (
            <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
              <FileCheck className="h-3 w-3 mr-1" />
              {order.report_status}
            </Badge>
          )}
        </div>
      </div>

      {/* Action toolbar */}
      <div className="flex items-center gap-2 flex-wrap border rounded-lg bg-muted/30 px-3 py-2">
        <Dialog open={opsStatusOpen} onOpenChange={setOpsStatusOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-update-ops-status">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Ops Stage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Ops Status</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="mb-2 block">New Ops Status</Label>
                <Select value={opsStatus} onValueChange={setOpsStatus}>
                  <SelectTrigger data-testid="select-ops-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPS_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Notes (optional)</Label>
                <Textarea
                  value={opsNotes}
                  onChange={(e) => setOpsNotes(e.target.value)}
                  placeholder="Add notes..."
                  data-testid="input-ops-notes"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpsStatusOpen(false)}>Cancel</Button>
                <Button onClick={handleOpsStatusUpdate} disabled={opsLoading} data-testid="button-confirm-ops-status">
                  {opsLoading ? "Updating..." : "Update"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={assignRcOpen} onOpenChange={setAssignRcOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-assign-ridechecker">
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Assign RideChecker
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign RideChecker</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {rcSuggestions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">No active RideCheckers found.</p>
                  <p className="text-xs text-muted-foreground">
                    Add RideCheckers from the{" "}
                    <Link href="/admin/inspectors" className="text-primary hover:underline">
                      RideCheckers page
                    </Link>.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Ranked by area match, rating, and current load</p>
                    <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">
                      {rcSuggestions.length} available
                    </Badge>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {rcSuggestions.map((rc: any) => (
                      <div
                        key={rc.id}
                        className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedRc === rc.id ? "border-primary bg-primary/5" : "hover-elevate"}`}
                        onClick={() => setSelectedRc(rc.id)}
                        data-testid={`rc-option-${rc.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{rc.full_name}</span>
                            <Badge variant="default" className="no-default-hover-elevate no-default-active-elevate text-[10px] px-1.5 py-0 bg-green-600">Active</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Rating: {rc.rating?.toFixed(1) ?? "N/A"}</span>
                            <span>Jobs: {rc.active_jobs}/{rc.max_daily_jobs ?? 5}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {rc.service_area && <span>Region: {rc.service_area}</span>}
                          {rc.phone && <span>Phone: {rc.phone}</span>}
                          {rc.email && <span>{rc.email}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAssignRcOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleAssignRidechecker}
                  disabled={assignRcLoading || !selectedRc}
                  data-testid="button-confirm-assign-ridechecker"
                >
                  {assignRcLoading ? "Assigning..." : "Assign"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {order.booking_type === "concierge" && order.payment_status !== "paid" && (
          <Button variant="outline" size="sm" onClick={handleRequestPayment} data-testid="button-request-payment">
            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
            Request Payment
          </Button>
        )}

        {order.report_status === "approved" && (
          <Button variant="outline" size="sm" onClick={handleDeliverReport} disabled={deliverLoading} data-testid="button-deliver-report">
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {deliverLoading ? "Delivering..." : "Deliver Report"}
          </Button>
        )}

        <StatusUpdateDialog
          orderId={orderId}
          currentStatus={order.status}
          onUpdate={handleStatusUpdate}
        />
      </div>

      {/* ── Needs Buyer Info warning ── */}
      {order.ops_status === "needs_buyer_info" && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm" data-testid="alert-needs-buyer-info">
          <HelpCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">Needs Buyer Info</p>
            <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
              The listing URL may be dead or vehicle details are incorrect.
              The order remains <strong>paid</strong> — do not cancel.
              Correct the vehicle/listing info in the panel below, then restore to Contact Seller.
            </p>
          </div>
        </div>
      )}

      {/* ── Payment status mismatch warning ── */}
      {["payment_received", "assigned", "active", "inspection_complete", "report_ready", "delivered"].includes(order.ops_status || "") &&
        !["paid", "paid_manual_verified"].includes(order.payment_status || "") && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm" data-testid="alert-payment-mismatch">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">Payment status mismatch</p>
            <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
              The ops stage is set to <strong>{statusLabel(order.ops_status || "")}</strong> but the actual payment status is{" "}
              <strong>{statusLabel(order.payment_status || "unknown")}</strong>. No Stripe payment has been confirmed.
              Use <em>Manually Verify Payment</em> if payment was received outside Stripe, or correct the ops stage.
            </p>
          </div>
        </div>
      )}

      {/* ── Control-center top row: Buyer + Next Action ── */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-start">
        <AdminBuyerCard order={order} onRefresh={loadData} currentUserRole={currentUserRole} />
        <NextActionPanel order={order} attemptCount={attemptCount} />
      </div>

      {/* ── Main content ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-4">
          <OrderDetailPanel order={order} activities={activities} />
          <VehicleInfoEditPanel order={order} onRefresh={loadData} />
          <SellerContactPanel order={order} onRefresh={loadData} />
        </div>
        <div className="space-y-4">
          <OpsReportBuilderPanel order={order} onRefresh={loadData} />

          {events.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Order Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 text-sm"
                      data-testid={`event-${event.id}`}
                    >
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{statusLabel(event.event_type)}</p>
                        {event.actor_email && (
                          <p className="text-muted-foreground text-xs">by {event.actor_email}</p>
                        )}
                        {event.details && (() => {
                          const label = formatEventDetails(event.details);
                          return label ? (
                            <p className="text-muted-foreground text-xs">{label}</p>
                          ) : null;
                        })()}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatRelative(event.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {audit.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Audit History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {audit.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 text-sm"
                      data-testid={`audit-${entry.id}`}
                    >
                      <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{entry.action}</p>
                        <p className="text-muted-foreground text-xs">
                          {entry.actor_email || "System"} ({entry.actor_role || "—"})
                        </p>
                        {entry.new_value && (() => {
                          const label = formatEventDetails(entry.new_value);
                          if (label) return <p className="text-muted-foreground text-xs">{label}</p>;
                          // Fallback: render as compact key→value pairs
                          const pairs = Object.entries(entry.new_value)
                            .filter(([, v]) => v != null && typeof v !== "object" && String(v).length < 80)
                            .map(([k, v]) => `${statusLabel(k)}: ${v}`);
                          return pairs.length > 0 ? (
                            <p className="text-muted-foreground text-xs">{pairs.join(" · ")}</p>
                          ) : null;
                        })()}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatRelative(entry.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
