"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Order, OrderEvent, AuditLogEntry, ActivityLogEntry } from "@/types/orders";
import { OrderDetailPanel } from "@/components/orders/OrderDetailPanel";
import { SellerContactPanel } from "@/components/orders/SellerContactPanel";
import { OpsReportBuilderPanel } from "@/components/orders/OpsReportBuilderPanel";
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
  Users,
  CreditCard,
  Copy,
  Clock,
  Shield,
  Send,
  FileCheck,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatRelative, statusLabel } from "@/lib/utils/format";

const OPS_STATUSES = [
  "new",
  "seller_outreach",
  "seller_confirmed",
  "payment_pending",
  "payment_received",
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

  const [opsStatusOpen, setOpsStatusOpen] = useState(false);
  const [opsStatus, setOpsStatus] = useState("");
  const [opsNotes, setOpsNotes] = useState("");
  const [opsLoading, setOpsLoading] = useState(false);

  const [assignRcOpen, setAssignRcOpen] = useState(false);
  const [rcSuggestions, setRcSuggestions] = useState<any[]>([]);
  const [rcPreview, setRcPreview] = useState<{ total: number; available: number; closest: string | null } | null>(null);
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

  useEffect(() => {
    if (order && !assignedRc) {
      const area = order.vehicle_location || order.inspection_address || "";
      fetch(`/api/admin/ridecheckers/suggest?area=${encodeURIComponent(area)}&orderId=${orderId}`)
        .then((r) => r.json())
        .then((data) => {
          const suggestions = data.suggestions || [];
          setRcPreview({
            total: suggestions.length,
            available: suggestions.filter((s: any) => s.active_jobs < (s.max_daily_jobs ?? 5)).length,
            closest: suggestions.length > 0 ? suggestions[0].full_name : null,
          });
        })
        .catch(() => {
          setRcPreview({ total: 0, available: 0, closest: null });
        });
    }
  }, [order, orderId, assignedRc]);

  useEffect(() => {
    if (assignRcOpen && order) {
      const area = order.vehicle_location || order.inspection_address || "";
      fetch(`/api/admin/ridecheckers/suggest?area=${encodeURIComponent(area)}&orderId=${orderId}`)
        .then((r) => r.json())
        .then((data) => {
          setRcSuggestions(data.suggestions || []);
        })
        .catch(() => {
          setRcSuggestions([]);
        });
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
    const res = await fetch(`/api/orders/${orderId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inspector_id: selectedRc }),
    });
    setAssignRcLoading(false);
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "RideChecker assigned" });
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


  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied to clipboard` });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/admin/orders">
          <Button variant="ghost" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate" data-testid="badge-ops-status">
            Ops: {statusLabel(order.ops_status || "new")}
          </Badge>
          {assignedRc && (
            <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate" data-testid="badge-ridechecker">
              RideChecker: {assignedRc.full_name}
            </Badge>
          )}
        </div>
      </div>

      {!assignedRc && rcPreview && (
        <Card className="border-dashed">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Active RideCheckers:</span>
                <span className="font-medium" data-testid="text-rc-total">{rcPreview.total}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Available now:</span>
                <span className="font-medium" data-testid="text-rc-available">{rcPreview.available}</span>
              </div>
              {rcPreview.closest && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Top match:</span>
                  <span className="font-medium" data-testid="text-rc-closest">{rcPreview.closest}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Dialog open={opsStatusOpen} onOpenChange={setOpsStatusOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-update-ops-status">
              <RefreshCw className="h-4 w-4 mr-2" />
              Update Ops Status
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
                <Button variant="outline" onClick={() => setOpsStatusOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleOpsStatusUpdate}
                  disabled={opsLoading}
                  data-testid="button-confirm-ops-status"
                >
                  {opsLoading ? "Updating..." : "Update"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={assignRcOpen} onOpenChange={setAssignRcOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-assign-ridechecker">
              <UserPlus className="h-4 w-4 mr-2" />
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
                  <p className="text-xs text-muted-foreground">Add RideCheckers from the <Link href="/admin/inspectors" className="text-primary hover:underline">RideCheckers page</Link>.</p>
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
                <Button variant="outline" onClick={() => setAssignRcOpen(false)}>
                  Cancel
                </Button>
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
          <Button
            variant="outline"
            onClick={handleRequestPayment}
            data-testid="button-request-payment"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Request Payment
          </Button>
        )}

        {order.report_status === "approved" && (
          <Button
            variant="outline"
            onClick={handleDeliverReport}
            disabled={deliverLoading}
            data-testid="button-deliver-report"
          >
            <Send className="h-4 w-4 mr-2" />
            {deliverLoading ? "Delivering..." : "Deliver Report"}
          </Button>
        )}

        {order.report_status && (
          <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
            <FileCheck className="h-3 w-3 mr-1" />
            Report: {order.report_status}
          </Badge>
        )}

        <StatusUpdateDialog
          orderId={orderId}
          currentStatus={order.status}
          onUpdate={handleStatusUpdate}
        />

        {order.customer_email && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => copyToClipboard(order.customer_email, "Email")}
            data-testid="button-copy-email"
            title="Copy email"
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {order.customer_phone && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => copyToClipboard(order.customer_phone!, "Phone")}
            data-testid="button-copy-phone"
            title="Copy phone"
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>

      <OrderDetailPanel order={order} activities={activities} />

      <SellerContactPanel order={order} onRefresh={loadData} />

      <OpsReportBuilderPanel order={order} onRefresh={loadData} />

      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Order Events Timeline
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
                    {event.details && (
                      <p className="text-muted-foreground text-xs">
                        {JSON.stringify(event.details)}
                      </p>
                    )}
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
                    {entry.new_value && (
                      <p className="text-muted-foreground text-xs truncate max-w-md">
                        {JSON.stringify(entry.new_value)}
                      </p>
                    )}
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
  );
}
