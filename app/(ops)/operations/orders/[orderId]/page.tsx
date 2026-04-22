"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Order, ActivityLogEntry, Profile } from "@/types/orders";
import { OrderDetailPanel } from "@/components/orders/OrderDetailPanel";
import { StatusUpdateDialog } from "@/components/orders/StatusUpdateDialog";
import { AssignOpsDialog } from "@/components/orders/AssignOpsDialog";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Send, ShieldCheck, Sparkles, FileText, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { canUpdateStatus, canAssignOps, canSendPayment, type Role } from "@/lib/utils/roles";
import { packageLabel } from "@/lib/utils/format";

const PACKAGE_OPTIONS = [
  { value: "standard", label: "Basic — $139" },
  { value: "plus", label: "Plus — $169" },
  { value: "exotic", label: "Exotic — $299" },
];

export default function OpsOrderDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const supabase = createClient();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [overridePackage, setOverridePackage] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportVerdict, setReportVerdict] = useState<string | null>(null);

  async function loadData() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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

    if (orderRes.data) setOrder(orderRes.data);
    if (activityRes.data) setActivities(activityRes.data);
    if (profileRes.data) setProfile(profileRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [orderId]);

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
    const res = await fetch(`/api/orders/${orderId}/send-payment`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Payment link sent" });
    loadData();
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
        package_override: overridePackage,
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

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/ops/orders/${orderId}/generate-report`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Report generation failed", description: data.error, variant: "destructive" });
        return;
      }
      setReportUrl(data.report_url);
      setReportVerdict(data.verdict);
      toast({ title: "Report generated!", description: `Verdict: ${data.verdict.replace(/_/g, " ")}` });
      loadData();
    } catch {
      toast({ title: "Failed to generate report", variant: "destructive" });
    } finally {
      setGenerating(false);
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

  const role = (profile?.role || "operations") as Role;
  const canOverride = ["admin", "operations"].includes(role);
  const systemReason = order.classification_reason || "—";
  const isOverridden = systemReason.startsWith("[OPS OVERRIDE");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/operations/orders">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
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
                data-testid="button-send-payment"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Payment Link
              </Button>
            )}
        </div>
      </div>

      <OrderDetailPanel order={order} activities={activities} />

      {/* AI Report Generation */}
      <Card data-testid="card-generate-report">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Intelligence Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(order.ops_report_url || reportUrl) ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">Report generated</span>
                {(reportVerdict || order.ops_severity_overall) && (
                  <span className="text-muted-foreground">
                    — Verdict: {(reportVerdict || order.ops_severity_overall || "").replace(/_/g, " ").toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={order.ops_report_url || reportUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-view-report">
                    <FileText className="h-3.5 w-3.5" />
                    View PDF
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleGenerateReport}
                  disabled={generating}
                  data-testid="button-regenerate-report"
                  className="text-muted-foreground"
                >
                  {generating ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</>
                  ) : (
                    "Regenerate"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Generate a branded PDF intelligence report using Claude AI. The RideChecker must have submitted their findings first.
              </p>
              <Button
                size="sm"
                onClick={handleGenerateReport}
                disabled={generating}
                className="gap-2"
                data-testid="button-generate-report"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Generating Report…</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Generate AI Report</>
                )}
              </Button>
              {generating && (
                <p className="text-xs text-muted-foreground">
                  Analyzing findings with Claude AI and rendering PDF — this takes about 15–30 seconds.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {canOverride && (
        <Card data-testid="card-package-override">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Package Override
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Current package:</span>{" "}
                <span className="font-semibold">{packageLabel(order.package)}</span>
                {order.base_price && (
                  <span className="ml-1 text-muted-foreground">
                    (${order.base_price})
                  </span>
                )}
              </p>
              <p>
                <span className="font-medium">System reason:</span>{" "}
                {isOverridden ? (
                  <span className="text-amber-600 dark:text-amber-400">{systemReason}</span>
                ) : (
                  <span>{systemReason}</span>
                )}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="override-pkg" className="text-xs">Force package to</Label>
                <Select
                  value={overridePackage}
                  onValueChange={setOverridePackage}
                >
                  <SelectTrigger
                    id="override-pkg"
                    className="h-8 text-xs"
                    data-testid="select-override-package"
                  >
                    <SelectValue placeholder="Select package…" />
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

              <div className="space-y-1.5">
                <Label htmlFor="override-reason" className="text-xs">Reason (optional)</Label>
                <Textarea
                  id="override-reason"
                  className="h-8 min-h-0 text-xs resize-none py-1.5"
                  placeholder="e.g. Buyer confirmed EV, diesel engine, etc."
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
              data-testid="button-apply-override"
            >
              {overrideLoading ? "Saving…" : "Apply Override"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
