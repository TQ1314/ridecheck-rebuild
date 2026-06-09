"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  DollarSign,
  Package,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CreditCard,
  TrendingUp,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp,
  Lock,
  Download,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/pricing";
import { formatRelative } from "@/lib/utils/format";

// ── Types ─────────────────────────────────────────────────────────────────────

type DatePreset = "today" | "week" | "month" | "last_month" | "custom";

interface RevenueData {
  period:         { from: string; to: string };
  total_jobs:     { count: number; today_count: number };
  paid_jobs:      {
    count: number; gross_total: number;
    today_count: number; today_gross: number;
    by_package: Record<string, { count: number; gross: number }>;
    stripe_linked: number; manual_verified: number;
  };
  completed_jobs:   { count: number; gross_total: number };
  reconcile_eligible: number;
  ridechecker_comp: {
    pay_owed:       number;
    pay_paid:       number;
    outstanding:    number;
    included_count: number;
  };
}

interface ReconcileData {
  period:               { from: string; to: string };
  ridecheck_gross:      number;
  stripe_gross:         number;
  difference:           number;
  stripe_fees:          number;
  stripe_net:           number;
  orders_in_period:     number;
  orders_with_stripe_id: number;
  orders_checked:       number;
  mismatches:           Mismatch[];
  unverifiable:         Unverifiable[];
  reconciled_at:        string;
  ridechecker_pay_owed:        number;
  ridechecker_pay_paid:        number;
  ridechecker_pay_outstanding: number;
  ridecheck_margin:            number;
}

interface Mismatch {
  order_id:         string;
  vehicle:          string;
  type:             string;
  ridecheck_amount: number;
  stripe_amount:    number | null;
  stripe_status:    string | null;
  message:          string;
}

interface Unverifiable {
  order_id:         string;
  vehicle:          string;
  reason:           string;
  ridecheck_amount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = new Set(["admin", "owner", "operations_lead", "ops_lead"]);

const PACKAGE_LABELS: Record<string, string> = {
  standard: "Standard",
  basic:    "Basic",
  plus:     "Plus",
  premium:  "Premium",
  exotic:   "Exotic",
};

const PACKAGE_COLORS: Record<string, string> = {
  standard: "bg-gray-100 dark:bg-gray-800",
  basic:    "bg-gray-100 dark:bg-gray-800",
  plus:     "bg-blue-50 dark:bg-blue-950/40",
  premium:  "bg-purple-50 dark:bg-purple-950/40",
  exotic:   "bg-amber-50 dark:bg-amber-950/40",
};

function getDateRange(preset: DatePreset, customFrom: string, customTo: string) {
  const now      = new Date();
  const todayStr = now.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "week": {
      const d   = new Date(now);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return { from: d.toISOString().split("T")[0], to: todayStr };
    }
    case "month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
        to:   todayStr,
      };
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: start.toISOString().split("T")[0],
        to:   end.toISOString().split("T")[0],
      };
    }
    case "custom":
      return { from: customFrom || todayStr, to: customTo || todayStr };
    default:
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
        to:   todayStr,
      };
  }
}

function mismatchTypeLabel(type: string) {
  switch (type) {
    case "ridecheck_paid_stripe_not_confirmed": return "RC Paid / Stripe Not Confirmed";
    case "stripe_confirmed_not_marked_paid":   return "Stripe Confirmed / RC Not Paid";
    case "amount_mismatch":                    return "Amount Mismatch";
    default: return type;
  }
}

function mismatchColor(type: string) {
  switch (type) {
    case "ridecheck_paid_stripe_not_confirmed": return "border-red-400 bg-red-50 dark:bg-red-950/30";
    case "stripe_confirmed_not_marked_paid":   return "border-amber-400 bg-amber-50 dark:bg-amber-950/30";
    case "amount_mismatch":                    return "border-orange-400 bg-orange-50 dark:bg-orange-950/30";
    default: return "border-gray-300 bg-gray-50";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const [userRole, setUserRole]       = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [preset, setPreset]           = useState<DatePreset>("month");
  const [customFrom, setCustomFrom]   = useState("");
  const [customTo, setCustomTo]       = useState("");
  const [filterPackage, setFilterPackage]         = useState("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("all");
  const [filterOpsStatus, setFilterOpsStatus]     = useState("all");

  const [loading, setLoading]         = useState(false);
  const [data, setData]               = useState<RevenueData | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const [reconciling, setReconciling]   = useState(false);
  const [reconcileData, setReconcileData] = useState<ReconcileData | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [showUnverifiable, setShowUnverifiable] = useState(false);

  const [exporting, setExporting]     = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // ── Role check ───────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setRoleLoading(false); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      setUserRole(profile?.role ?? null);
      setRoleLoading(false);
    });
  }, []);

  // ── Load stats ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const { from, to } = getDateRange(preset, customFrom, customTo);
    if (!from || !to) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (filterPackage       !== "all") params.set("package",        filterPackage);
      if (filterPaymentStatus !== "all") params.set("payment_status", filterPaymentStatus);
      if (filterOpsStatus     !== "all") params.set("ops_status",     filterOpsStatus);

      const res = await fetch(`/api/ops/revenue?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo, filterPackage, filterPaymentStatus, filterOpsStatus]);

  useEffect(() => {
    if (userRole && ALLOWED_ROLES.has(userRole)) loadData();
  }, [userRole, loadData]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExport = async () => {
    const { from, to } = getDateRange(preset, customFrom, customTo);
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (filterPackage       !== "all") params.set("package",        filterPackage);
      if (filterPaymentStatus !== "all") params.set("payment_status", filterPaymentStatus);
      if (filterOpsStatus     !== "all") params.set("ops_status",     filterOpsStatus);

      const res = await fetch(`/api/ops/revenue/export?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Export failed");
      }
      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement("a");
      a.href         = url;
      a.download     = `ridecheck-revenue-${from}-to-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  };

  // ── Reconcile ─────────────────────────────────────────────────────────────
  const handleReconcile = async () => {
    const { from, to } = getDateRange(preset, customFrom, customTo);
    setReconciling(true);
    setReconcileError(null);
    setReconcileData(null);
    try {
      const res = await fetch("/api/ops/revenue/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          package: filterPackage !== "all" ? filterPackage : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Reconcile failed");
      setReconcileData(json);
    } catch (e: any) {
      setReconcileError(e.message);
    } finally {
      setReconciling(false);
    }
  };

  // ── Loading / access guards ───────────────────────────────────────────────
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!userRole || !ALLOWED_ROLES.has(userRole)) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="font-semibold">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">
            Revenue & Jobs is only available to Admins and Operations Leads.
          </p>
        </div>
      </div>
    );
  }

  const { from, to } = getDateRange(preset, customFrom, customTo);

  const PRESET_BUTTONS: { key: DatePreset; label: string }[] = [
    { key: "today",      label: "Today" },
    { key: "week",       label: "This Week" },
    { key: "month",      label: "This Month" },
    { key: "last_month", label: "Last Month" },
    { key: "custom",     label: "Custom" },
  ];

  const warningCount = (reconcileData?.mismatches?.length ?? 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-5 w-5 text-primary" />
            Revenue &amp; Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Job volume, gross revenue, and Stripe reconciliation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={exporting || loading}
            data-testid="button-export-csv"
            className="gap-1.5"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            data-testid="button-refresh"
            className="gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Export failed: {exportError}
        </div>
      )}

      {/* ── Filters ── */}
      <Card className="p-3">
        <div className="space-y-3">
          {/* Date preset row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium w-10 flex-shrink-0">Period</span>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_BUTTONS.map((b) => (
                <Button
                  key={b.key}
                  size="sm"
                  variant={preset === b.key ? "default" : "outline"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setPreset(b.key)}
                  data-testid={`button-preset-${b.key}`}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom date range */}
          {preset === "custom" && (
            <div className="flex items-center gap-2 flex-wrap pl-12">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs w-8">From</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-7 text-xs w-36"
                  data-testid="input-custom-from"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs w-6">To</Label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-7 text-xs w-36"
                  data-testid="input-custom-to"
                />
              </div>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={loadData}
                disabled={!customFrom || !customTo || loading}
                data-testid="button-apply-custom"
              >
                Apply
              </Button>
            </div>
          )}

          {/* Dimension filters */}
          <div className="flex items-center gap-2 flex-wrap pl-12">
            <Select value={filterPackage} onValueChange={setFilterPackage}>
              <SelectTrigger className="h-7 text-xs w-32" data-testid="select-package">
                <SelectValue placeholder="All Packages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="plus">Plus</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="exotic">Exotic</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
              <SelectTrigger className="h-7 text-xs w-36" data-testid="select-payment-status">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment States</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="paid_manual_verified">Manually Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="requested">Requested</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterOpsStatus} onValueChange={setFilterOpsStatus}>
              <SelectTrigger className="h-7 text-xs w-36" data-testid="select-ops-status">
                <SelectValue placeholder="Ops Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ops Stages</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contact_seller">Contact Seller</SelectItem>
                <SelectItem value="payment_received">Payment Received</SelectItem>
                <SelectItem value="inspector_assigned">Inspector Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="report_review">Report Review</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Stat Cards ── */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Jobs */}
            <Card data-testid="card-total-jobs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Total Jobs Created
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="stat-total-count">
                  {data.total_jobs.count.toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span data-testid="stat-today-count">
                    {data.total_jobs.today_count} created today
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {from} → {to}
                </p>
              </CardContent>
            </Card>

            {/* Paid Jobs */}
            <Card data-testid="card-paid-jobs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Paid Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="stat-paid-gross">
                  {formatCurrency(data.paid_jobs.gross_total)}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <span data-testid="stat-paid-count">
                    {data.paid_jobs.count} paid job{data.paid_jobs.count !== 1 ? "s" : ""}
                  </span>
                  {data.paid_jobs.today_count > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
                      +{formatCurrency(data.paid_jobs.today_gross)} today
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Gross revenue shown before Stripe fees.
                  {data.paid_jobs.manual_verified > 0 && (
                    <span className="ml-1 text-amber-600">· {data.paid_jobs.manual_verified} manually verified</span>
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Completed Jobs */}
            <Card data-testid="card-completed-jobs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completed Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="stat-completed-gross">
                  {formatCurrency(data.completed_jobs.gross_total)}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <span data-testid="stat-completed-count">
                    {data.completed_jobs.count} completed
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  ops_status = completed or report delivered
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── RideChecker Compensation + RideCheck Margin ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* RideChecker Compensation */}
            <Card data-testid="card-rc-compensation">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  RideChecker Compensation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.ridechecker_comp.included_count === 0 ? (
                  <div className="text-sm text-muted-foreground py-1">
                    No completed jobs with payout records in this period.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pay Owed</span>
                      <span className="font-semibold" data-testid="stat-rc-pay-owed">
                        {formatCurrency(data.ridechecker_comp.pay_owed)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pay Paid</span>
                      <span className="font-semibold text-green-600 dark:text-green-400" data-testid="stat-rc-pay-paid">
                        {formatCurrency(data.ridechecker_comp.pay_paid)}
                      </span>
                    </div>
                    <div className={`flex items-center justify-between text-sm rounded-md px-2.5 py-1.5 -mx-2.5 font-semibold ${
                      data.ridechecker_comp.outstanding <= 0
                        ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                        : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                    }`}>
                      <span>Outstanding</span>
                      <span data-testid="stat-rc-outstanding">
                        {formatCurrency(Math.max(0, data.ridechecker_comp.outstanding))}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground pt-0.5">
                      {data.ridechecker_comp.included_count} completed inspection{data.ridechecker_comp.included_count !== 1 ? "s" : ""} with payout records
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* RideCheck Margin */}
            <Card data-testid="card-rc-margin">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  RideCheck Margin
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Gross Revenue</span>
                    <span className="font-medium">{formatCurrency(data.paid_jobs.gross_total)}</span>
                  </div>
                  {reconcileData ? (
                    <div className="flex items-center justify-between text-red-600 dark:text-red-400">
                      <span>Less Stripe Fees</span>
                      <span className="font-medium">−{formatCurrency(reconcileData.stripe_fees)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-muted-foreground text-xs italic">
                      <span>Stripe Fees</span>
                      <span>Reconcile to calculate</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                    <span>Less RC Compensation</span>
                    <span className="font-medium">−{formatCurrency(data.ridechecker_comp.pay_owed)}</span>
                  </div>
                  <div className="border-t pt-1.5 mt-1">
                    {reconcileData ? (
                      <div className="flex items-center justify-between font-bold text-base">
                        <span>RideCheck Margin</span>
                        <span
                          className={reconcileData.ridecheck_margin >= 0 ? "text-primary" : "text-red-600 dark:text-red-400"}
                          data-testid="stat-ridecheck-margin"
                        >
                          {formatCurrency(reconcileData.ridecheck_margin)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-sm">Partial Margin</span>
                        <span className="text-primary" data-testid="stat-ridecheck-margin-partial">
                          {formatCurrency(data.paid_jobs.gross_total - data.ridechecker_comp.pay_owed)}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    {reconcileData
                      ? "Gross revenue minus Stripe fees and RideChecker compensation."
                      : "Stripe fees excluded — reconcile with Stripe for full margin."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── By Package ── */}
          {data.paid_jobs.count > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Paid Jobs by Package
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {["standard", "plus", "premium", "exotic"].map((pkg) => {
                  const stats = data.paid_jobs.by_package[pkg];
                  if (!stats) return null;
                  return (
                    <div
                      key={pkg}
                      className={`rounded-lg border px-3 py-2.5 ${PACKAGE_COLORS[pkg] || ""}`}
                      data-testid={`card-package-${pkg}`}
                    >
                      <div className="text-xs font-medium">{PACKAGE_LABELS[pkg]}</div>
                      <div className="text-xl font-bold mt-0.5">
                        {stats.count > 0 ? formatCurrency(stats.gross) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats.count} job{stats.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Stripe Reconciliation ── */}
          <Card data-testid="card-stripe-reconciliation">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Stripe Reconciliation
                </CardTitle>
                <div className="flex items-center gap-2">
                  {reconcileData && (
                    <span className="text-xs text-muted-foreground">
                      Last run {formatRelative(reconcileData.reconciled_at)}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReconcile}
                    disabled={reconciling || data.reconcile_eligible === 0}
                    className="h-7 text-xs gap-1.5"
                    data-testid="button-reconcile"
                  >
                    {reconciling ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    {reconciling ? "Reconciling…" : "Reconcile with Stripe"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.reconcile_eligible === 0 && !reconcileData && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  No paid orders with Stripe IDs found in this period.
                  {data.paid_jobs.manual_verified > 0 && (
                    <span className="text-amber-600 ml-1">
                      ({data.paid_jobs.manual_verified} manually verified — not reconcilable)
                    </span>
                  )}
                </div>
              )}

              {!reconcileData && data.reconcile_eligible > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  Click <strong>Reconcile with Stripe</strong> to compare{" "}
                  {data.reconcile_eligible} order{data.reconcile_eligible !== 1 ? "s" : ""} against
                  live Stripe data.
                </div>
              )}

              {reconcileError && (
                <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  {reconcileError}
                </div>
              )}

              {reconcileData && (
                <>
                  {/* Summary table */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="rounded-md border bg-muted/30 px-3 py-2.5">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">RideCheck Gross</div>
                      <div className="text-lg font-bold mt-0.5" data-testid="recon-ridecheck-gross">
                        {formatCurrency(reconcileData.ridecheck_gross)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-3 py-2.5">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Stripe Gross</div>
                      <div className="text-lg font-bold mt-0.5" data-testid="recon-stripe-gross">
                        {formatCurrency(reconcileData.stripe_gross)}
                      </div>
                    </div>
                    <div className={`rounded-md border px-3 py-2.5 ${
                      Math.abs(reconcileData.difference) < 0.01
                        ? "bg-green-50 dark:bg-green-950/30 border-green-300"
                        : "bg-amber-50 dark:bg-amber-950/30 border-amber-300"
                    }`}>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Difference</div>
                      <div className={`text-lg font-bold mt-0.5 ${
                        Math.abs(reconcileData.difference) < 0.01
                          ? "text-green-600 dark:text-green-400"
                          : "text-amber-700 dark:text-amber-400"
                      }`} data-testid="recon-difference">
                        {reconcileData.difference >= 0 ? "+" : ""}
                        {formatCurrency(reconcileData.difference)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-3 py-2.5">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Stripe Fees</div>
                      <div className="text-lg font-bold mt-0.5 text-red-600 dark:text-red-400" data-testid="recon-fees">
                        -{formatCurrency(reconcileData.stripe_fees)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-3 py-2.5">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Stripe Net Payout</div>
                      <div className="text-lg font-bold mt-0.5 text-primary" data-testid="recon-net">
                        {formatCurrency(reconcileData.stripe_net)}
                      </div>
                    </div>
                  </div>

                  {/* Coverage note */}
                  <p className="text-[11px] text-muted-foreground">
                    Checked {reconcileData.orders_checked} of {reconcileData.orders_in_period} paid orders
                    ({reconcileData.orders_with_stripe_id} had Stripe IDs).
                    {reconcileData.unverifiable.length > 0 && (
                      <span className="text-amber-600 ml-1">
                        {reconcileData.unverifiable.length} unverifiable (no Stripe ID or fetch failed).
                      </span>
                    )}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Warnings / Mismatches ── */}
          {reconcileData && warningCount > 0 && (
            <Card className="border-amber-300" data-testid="card-warnings">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-4 w-4" />
                  {warningCount} Reconciliation Warning{warningCount !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reconcileData.mismatches.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-xs ${mismatchColor(m.type)}`}
                    data-testid={`warning-${i}`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{m.vehicle}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
                          {mismatchTypeLabel(m.type)}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5">{m.message}</p>
                      <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span>RideCheck: {formatCurrency(m.ridecheck_amount)}</span>
                        {m.stripe_amount !== null && (
                          <span>Stripe: {formatCurrency(m.stripe_amount)}</span>
                        )}
                        {m.stripe_status && (
                          <span>Stripe status: <strong>{m.stripe_status}</strong></span>
                        )}
                        <span className="font-mono text-[10px]">{m.order_id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Unverifiable orders (collapsible) ── */}
          {reconcileData && reconcileData.unverifiable.length > 0 && (
            <div>
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowUnverifiable((v) => !v)}
                data-testid="button-toggle-unverifiable"
              >
                {showUnverifiable ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {reconcileData.unverifiable.length} unverifiable order{reconcileData.unverifiable.length !== 1 ? "s" : ""} (no Stripe ID)
              </button>
              {showUnverifiable && (
                <div className="mt-2 rounded-md border divide-y text-xs">
                  {reconcileData.unverifiable.map((u, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                      <span className="font-medium">{u.vehicle}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{formatCurrency(u.ridecheck_amount)}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
                          {u.reason === "no_stripe_id" ? "No Stripe ID" : "Fetch Failed"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── All clear ── */}
          {reconcileData && warningCount === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-700 dark:text-green-400" data-testid="banner-all-clear">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              All checked orders reconcile cleanly with Stripe. No mismatches found.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
