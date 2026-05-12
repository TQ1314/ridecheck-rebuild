"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  UserCheck,
  ArrowRight,
  RefreshCw,
  Loader2,
  DollarSign,
  ClipboardList,
  Wallet,
  Users,
  Zap,
  Circle,
  Calendar,
  ChevronRight,
  Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRelative } from "@/lib/utils/format";

// ── Types ────────────────────────────────────────────────────────────────────
type Urgency = "high" | "medium" | "low" | "done";

interface OrderQueueItem {
  id: string;
  order_id: string;
  vehicle: string;
  package: string | null;
  status: string;
  assignment_status: string;
  payment_status: string | null;
  scheduled_date: string | null;
  created_at: string;
  next_action: string;
  next_action_urgency: Urgency;
  next_action_link: string;
  offered_pay: number | null;
  assigned_ridechecker_id: string | null;
}

interface RCAvailability {
  ridechecker_id: string;
  full_name: string;
  email: string;
  available_today: boolean;
  today_start: string | null;
  today_end: string | null;
  max_jobs: number | null;
  active_jobs: number;
  at_capacity: boolean;
}

interface DashboardStats {
  total_active: number;
  unassigned_paid: number;
  awaiting_rc: number;
  active_inspections: number;
  pending_review: number;
  report_ready: number;
}

interface PayoutSummary {
  pending_count: number;
  pending_total: number;
  approved_count: number;
  approved_total: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const URGENCY_CONFIG: Record<Urgency, { bg: string; text: string; dot: string }> = {
  high:   { bg: "bg-red-50 dark:bg-red-950/20",    text: "text-red-700 dark:text-red-400",    dot: "bg-red-500"   },
  medium: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  low:    { bg: "bg-blue-50 dark:bg-blue-950/20",   text: "text-blue-700 dark:text-blue-400",   dot: "bg-blue-400"  },
  done:   { bg: "bg-muted/30",                       text: "text-muted-foreground",               dot: "bg-gray-300"  },
};

function NextActionBadge({ label, urgency }: { label: string; urgency: Urgency }) {
  const c = URGENCY_CONFIG[urgency];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {label}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconColor,
  bgColor,
  alert,
  "data-testid": testId,
}: {
  icon: any;
  label: string;
  value: number;
  iconColor: string;
  bgColor: string;
  alert?: boolean;
  "data-testid"?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${bgColor}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${alert && value > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type UrgencyFilter = "all" | Urgency;

// ── Page ─────────────────────────────────────────────────────────────────────
export default function OperationsDashboardPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orderQueue, setOrderQueue] = useState<OrderQueueItem[]>([]);
  const [rcAvailability, setRcAvailability] = useState<RCAvailability[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/ops/dashboard");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats ?? null);
        setOrderQueue(data.order_queue ?? []);
        setRcAvailability(data.rc_availability ?? []);
        setPayoutSummary(data.payout_summary ?? null);
      } else {
        if (!silent) toast({ title: "Failed to load dashboard", variant: "destructive" });
      }
    } catch {
      if (!silent) toast({ title: "Failed to load dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard(false);
    // Auto-refresh every 60s
    intervalRef.current = setInterval(() => loadDashboard(true), 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadDashboard]);

  // Filtered order queue
  const filteredQueue = urgencyFilter === "all"
    ? orderQueue
    : orderQueue.filter((o) => o.next_action_urgency === urgencyFilter);

  const highCount = orderQueue.filter((o) => o.next_action_urgency === "high").length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const todayAvailRC = rcAvailability.filter((rc) => rc.available_today && !rc.at_capacity);
  const atCapacityRC = rcAvailability.filter((rc) => rc.at_capacity);
  const unavailableRC = rcAvailability.filter((rc) => !rc.available_today);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-ops-dashboard-title">
            Operations Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            data-testid="button-refresh-dashboard"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/operations/live">
            <Button size="sm" variant="outline" data-testid="button-live-board">
              <Activity className="h-4 w-4 mr-1.5 text-green-600" />
              Live Board
            </Button>
          </Link>
          <Link href="/operations/orders">
            <Button size="sm" data-testid="button-view-all-orders">
              <ClipboardList className="h-4 w-4 mr-1.5" />
              All Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={Package}
          label="Active Orders"
          value={stats?.total_active ?? 0}
          iconColor="text-blue-600 dark:text-blue-400"
          bgColor="bg-blue-500/10"
          data-testid="stat-total-active"
        />
        <StatCard
          icon={AlertTriangle}
          label="Unassigned (Paid)"
          value={stats?.unassigned_paid ?? 0}
          iconColor="text-red-600 dark:text-red-400"
          bgColor="bg-red-500/10"
          alert
          data-testid="stat-unassigned"
        />
        <StatCard
          icon={Zap}
          label="Awaiting RC"
          value={stats?.awaiting_rc ?? 0}
          iconColor="text-amber-600 dark:text-amber-400"
          bgColor="bg-amber-500/10"
          data-testid="stat-awaiting-rc"
        />
        <StatCard
          icon={Wrench}
          label="Active Inspections"
          value={stats?.active_inspections ?? 0}
          iconColor="text-indigo-600 dark:text-indigo-400"
          bgColor="bg-indigo-500/10"
          data-testid="stat-active-inspections"
        />
        <StatCard
          icon={ClipboardList}
          label="Pending Review"
          value={stats?.pending_review ?? 0}
          iconColor="text-orange-600 dark:text-orange-400"
          bgColor="bg-orange-500/10"
          alert
          data-testid="stat-pending-review"
        />
        <StatCard
          icon={CheckCircle2}
          label="Report Ready"
          value={stats?.report_ready ?? 0}
          iconColor="text-green-600 dark:text-green-400"
          bgColor="bg-green-500/10"
          alert
          data-testid="stat-report-ready"
        />
      </div>

      {/* ── Main Content: 2 columns ────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

        {/* LEFT: Order Queue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Order Queue
              {highCount > 0 && (
                <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800 ml-1">
                  {highCount} urgent
                </Badge>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <Select
                value={urgencyFilter}
                onValueChange={(v) => setUrgencyFilter(v as UrgencyFilter)}
              >
                <SelectTrigger className="h-8 text-xs w-36" data-testid="select-urgency-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All orders</SelectItem>
                  <SelectItem value="high">High urgency</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low / Scheduled</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium">No orders match this filter</p>
                <p className="text-sm text-muted-foreground">Try switching to "All orders"</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Vehicle</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Package</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Next Action</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Scheduled</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Created</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">Pay</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredQueue.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-muted/30 transition-colors"
                        data-testid={`row-order-${order.id}`}
                      >
                        <td className="px-3 py-3">
                          <div>
                            <p className="font-medium text-sm leading-tight" data-testid={`text-order-vehicle-${order.id}`}>
                              {order.vehicle || "Vehicle TBD"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              #{order.order_id?.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          {order.package && (
                            <span className="text-xs capitalize text-muted-foreground">
                              {order.package}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <NextActionBadge
                            label={order.next_action}
                            urgency={order.next_action_urgency}
                          />
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          {order.scheduled_date ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {order.scheduled_date}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {formatRelative(order.created_at)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right hidden md:table-cell">
                          {order.offered_pay != null ? (
                            <span className="text-xs font-medium text-green-700 dark:text-green-400">
                              ${order.offered_pay}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link href={`/operations/orders/${order.id}`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              data-testid={`button-view-order-${order.id}`}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Sidebar panels */}
        <div className="space-y-4">

          {/* RideChecker Availability */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  RC Availability Today
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {rcAvailability.length} active
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 p-0 pb-2">
              {rcAvailability.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No active RideCheckers
                </p>
              ) : (
                <>
                  {/* Available + not at capacity */}
                  {todayAvailRC.length > 0 && (
                    <div>
                      <p className="px-4 pt-1 pb-1.5 text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">
                        Available Now
                      </p>
                      {todayAvailRC.map((rc) => (
                        <RCAvailRow key={rc.ridechecker_id} rc={rc} />
                      ))}
                    </div>
                  )}

                  {/* At capacity */}
                  {atCapacityRC.length > 0 && (
                    <div>
                      <p className="px-4 pt-2 pb-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                        At Capacity
                      </p>
                      {atCapacityRC.map((rc) => (
                        <RCAvailRow key={rc.ridechecker_id} rc={rc} />
                      ))}
                    </div>
                  )}

                  {/* Not available today */}
                  {unavailableRC.length > 0 && (
                    <div>
                      <p className="px-4 pt-2 pb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Not Available Today
                      </p>
                      {unavailableRC.map((rc) => (
                        <RCAvailRow key={rc.ridechecker_id} rc={rc} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Payout Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Payouts
                </span>
                <Link href="/operations/payouts">
                  <button className="text-xs text-primary hover:underline flex items-center gap-0.5">
                    Manage <ArrowRight className="h-3 w-3" />
                  </button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payoutSummary ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-3">
                      <div className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400 mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Pending</span>
                      </div>
                      <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400" data-testid="text-pending-payout-total">
                        ${payoutSummary.pending_total}
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-500">
                        {payoutSummary.pending_count} payout{payoutSummary.pending_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                      <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Approved</span>
                      </div>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-400" data-testid="text-approved-payout-total">
                        ${payoutSummary.approved_total}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-500">
                        {payoutSummary.approved_count} ready to pay
                      </p>
                    </div>
                  </div>
                  {(payoutSummary.pending_count > 0 || payoutSummary.approved_count > 0) && (
                    <Link href="/operations/payouts">
                      <Button className="w-full h-8 text-xs gap-1.5" size="sm" data-testid="button-manage-payouts">
                        <Wallet className="h-3.5 w-3.5" />
                        Review &amp; Approve Payouts
                      </Button>
                    </Link>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No payout data</p>
              )}
            </CardContent>
          </Card>

          {/* Assignment Controls — unassigned paid orders */}
          {orderQueue.filter((o) => o.next_action === "Assign RideChecker").length > 0 && (
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                  <UserCheck className="h-4 w-4" />
                  Needs Assignment ({orderQueue.filter((o) => o.next_action === "Assign RideChecker").length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {orderQueue
                  .filter((o) => o.next_action === "Assign RideChecker")
                  .slice(0, 5)
                  .map((order) => (
                    <Link key={order.id} href={`/operations/orders/${order.id}`}>
                      <div
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 border border-red-100 dark:border-red-900/40 transition-colors"
                        data-testid={`item-unassigned-${order.id}`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{order.vehicle || "Vehicle TBD"}</p>
                          <p className="text-[11px] text-muted-foreground">#{order.order_id?.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                {orderQueue.filter((o) => o.next_action === "Assign RideChecker").length > 5 && (
                  <Link href="/operations/orders">
                    <p className="text-xs text-center text-primary hover:underline pt-1">
                      +{orderQueue.filter((o) => o.next_action === "Assign RideChecker").length - 5} more
                    </p>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

// ── RCAvailRow component ──────────────────────────────────────────────────────
function RCAvailRow({ rc }: { rc: RCAvailability }) {
  const jobsLeft = rc.max_jobs != null ? rc.max_jobs - rc.active_jobs : null;

  return (
    <div
      className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors"
      data-testid={`row-rc-availability-${rc.ridechecker_id}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Circle
          className={`h-2 w-2 flex-shrink-0 fill-current ${
            rc.at_capacity
              ? "text-amber-500"
              : rc.available_today
              ? "text-green-500"
              : "text-gray-300"
          }`}
        />
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" data-testid={`text-rc-name-${rc.ridechecker_id}`}>
            {rc.full_name}
          </p>
          {rc.available_today && rc.today_start && (
            <p className="text-[11px] text-muted-foreground">
              {rc.today_start}–{rc.today_end}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className={`text-[11px] font-medium ${
            rc.at_capacity
              ? "text-amber-600 dark:text-amber-400"
              : rc.active_jobs > 0
              ? "text-blue-600 dark:text-blue-400"
              : "text-muted-foreground"
          }`}
        >
          {rc.active_jobs}{rc.max_jobs != null ? `/${rc.max_jobs}` : ""} job{rc.active_jobs !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
