"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  DollarSign,
  Wallet,
  CreditCard,
  Users,
  Copy,
  Gift,
  CalendarDays,
  Star,
  GraduationCap,
  MapPin,
  Calendar,
  Car,
  Play,
  Upload,
  Plus,
  Zap,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRelative } from "@/lib/utils/format";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  pendingUpload: number;
}

interface Assignment {
  id: string;
  order_id: string;
  status: string;
  payout_amount?: number;
  expires_at?: string | null;
  accepted_at?: string | null;
  started_at?: string | null;
  submitted_at?: string | null;
  job_score?: number;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_location?: string;
  inspection_address?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  order?: any;
}

interface Payout {
  id: string;
  order_id: string;
  base_pay: number;
  bonus: number;
  total_pay: number;
  status: "pending" | "approved" | "paid" | "cancelled";
  vehicle_label: string | null;
  scheduled_date: string | null;
  paid_at: string | null;
  approved_at: string | null;
  created_at: string;
}

interface PayoutSummary {
  total_earned: number;
  pending: number;
  approved: number;
  paid: number;
  total_jobs: number;
}

interface ReferralStats {
  totalReferred: number;
  qualified: number;
  pending: number;
  totalRewardEarned: number;
}

interface AvailabilitySlot {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
  max_jobs: number;
}

type TabKey = "overview" | "jobs" | "payouts" | "availability" | "training";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview",      label: "Overview"    },
  { key: "jobs",          label: "My Jobs"     },
  { key: "payouts",       label: "Pay & Payouts" },
  { key: "availability",  label: "Availability" },
  { key: "training",      label: "Training"    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatStatus(status: string): string {
  if (!status) return "Pending";
  const labels: Record<string, string> = {
    awaiting_acceptance: "Action Required",
    in_progress: "In Progress",
  };
  return labels[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function assignmentBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "approved":
    case "paid":
      return "default";
    case "in_progress":
    case "accepted":
      return "secondary";
    case "submitted":
      return "outline";
    case "declined":
    case "rejected":
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}

function payoutStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Paid</Badge>;
    case "approved":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Approved</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="text-xs text-muted-foreground">Cancelled</Badge>;
    default:
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">Pending</Badge>;
  }
}

// Countdown hook
function useCountdown(expiresAt: string | null | undefined) {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      setSecsLeft(Math.max(0, diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return secsLeft;
}

function CountdownBadge({ expiresAt }: { expiresAt?: string | null }) {
  const secs = useCountdown(expiresAt);
  if (secs === null || !expiresAt) return null;
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  const urgent = secs < 180;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
      secs === 0 ? "bg-gray-100 text-gray-500" :
      urgent ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
    }`}>
      <Clock className="h-3 w-3" />
      {secs === 0 ? "Expired" : `${mins}m ${s < 10 ? "0" : ""}${s}s`}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RideCheckerDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState<DashboardStats>({ totalJobs: 0, activeJobs: 0, completedJobs: 0, pendingUpload: 0 });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary>({ total_earned: 0, pending: 0, approved: 0, paid: 0, total_jobs: 0 });
  const [referralCode, setReferralCode] = useState("");
  const [referralStats, setReferralStats] = useState<ReferralStats>({ totalReferred: 0, qualified: 0, pending: 0, totalRewardEarned: 0 });
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availForm, setAvailForm] = useState({ date: "", start_time: "09:00", end_time: "17:00", max_jobs: 3 });
  const [availSubmitting, setAvailSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [availabilityUpdatedAt, setAvailabilityUpdatedAt] = useState<string | null>(null);
  const [availToggleLoading, setAvailToggleLoading] = useState(false);
  const availToggleInFlightRef = useRef(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendedUntil, setSuspendedUntil] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/auth/login"); return; }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (prof) setProfile(prof);

    const [jobsData, payoutsData, referralsData, availData] = await Promise.all([
      fetch("/api/ridechecker/jobs").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/ridechecker/payouts").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/ridechecker/referrals").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/ridechecker/availability").then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);

    if (jobsData?.stats) setStats(jobsData.stats);
    if (jobsData?.assignments) {
      // Enrich assignments with order data
      const enriched = (jobsData.assignments as any[]).map((a: any) => ({
        ...a,
        vehicle_year: a.order?.vehicle_year ?? a.vehicle_year,
        vehicle_make: a.order?.vehicle_make ?? a.vehicle_make,
        vehicle_model: a.order?.vehicle_model ?? a.vehicle_model,
        vehicle_location: a.order?.vehicle_location ?? a.vehicle_location,
        inspection_address: a.order?.inspection_address ?? a.inspection_address,
        scheduled_date: a.order?.scheduled_date ?? a.scheduled_date,
        scheduled_time: a.order?.scheduled_time ?? a.scheduled_time,
      }));
      setAssignments(enriched);
    }
    if (payoutsData?.payouts) setPayouts(payoutsData.payouts);
    if (payoutsData?.summary) setPayoutSummary(payoutsData.summary);
    if (referralsData?.referralCode) setReferralCode(referralsData.referralCode);
    if (referralsData?.stats) setReferralStats(referralsData.stats);
    if (availData?.availability) setAvailability(availData.availability);

    if (prof && !availToggleInFlightRef.current) {
      setIsAvailable(!!prof.is_available);
      if (prof.availability_updated_at) setAvailabilityUpdatedAt(prof.availability_updated_at);
      const until = prof.suspended_until ?? null;
      const suspended = prof.availability_status === "suspended" && until !== null && new Date(until) > new Date();
      setIsSuspended(suspended);
      setSuspendedUntil(until);
    }

    setLoading(false);
    setRefreshing(false);
  }, [router, supabase]);

  useEffect(() => { loadData(false); }, [loadData]);

  const copyReferralCode = async () => {
    try { await navigator.clipboard.writeText(referralCode); toast({ title: "Referral code copied!" }); }
    catch { toast({ title: "Failed to copy", variant: "destructive" }); }
  };

  const copyReferralLink = async () => {
    const link = `${window.location.origin}/careers?ref=${referralCode}`;
    try { await navigator.clipboard.writeText(link); toast({ title: "Referral link copied!" }); }
    catch { toast({ title: "Failed to copy", variant: "destructive" }); }
  };

  const handleAccept = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/accept`, { method: "POST" });
    if (res.ok) {
      toast({ title: "Job accepted!" });
      setAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, status: "accepted" } : a));
    } else {
      const d = await res.json();
      toast({ title: d.error || "Failed to accept", variant: "destructive" });
      if (res.status === 410) setAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, status: "expired" } : a));
    }
    setActionLoading(null);
  };

  const handleDecline = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "declined_by_ridechecker" }),
    });
    if (res.ok) {
      toast({ title: "Job declined" });
      setAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, status: "declined" } : a));
    } else {
      toast({ title: "Failed to decline", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleStart = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/start`, { method: "POST" });
    if (res.ok) {
      toast({ title: "Inspection started!" });
      setAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, status: "in_progress" } : a));
    } else {
      const d = await res.json();
      toast({ title: d.error || "Failed to start", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleToggleAvailability = async () => {
    availToggleInFlightRef.current = true;
    setAvailToggleLoading(true);
    const newValue = !isAvailable;
    try {
      const res = await fetch("/api/ridechecker/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: newValue }),
      });
      if (res.ok) {
        const d = await res.json();
        setIsAvailable(d.is_available);
        if (d.availability_updated_at) setAvailabilityUpdatedAt(d.availability_updated_at);
        toast({ title: newValue ? "You are now available for inspections" : "You are now marked unavailable" });
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: d.error || "Failed to update availability", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error updating availability", variant: "destructive" });
    } finally {
      availToggleInFlightRef.current = false;
      setAvailToggleLoading(false);
    }
  };

  const handleAddAvailability = async () => {
    if (!availForm.date) { toast({ title: "Please select a date", variant: "destructive" }); return; }
    setAvailSubmitting(true);
    const res = await fetch("/api/ridechecker/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(availForm),
    });
    if (res.ok) {
      const d = await res.json();
      toast({ title: "Availability saved!" });
      if (d.availability) {
        setAvailability((prev) => {
          const filtered = prev.filter((a) => a.date !== d.availability.date);
          return [...filtered, d.availability].sort((a, b) => a.date.localeCompare(b.date));
        });
      }
      setAvailForm({ date: "", start_time: "09:00", end_time: "17:00", max_jobs: 3 });
    } else {
      const d = await res.json();
      toast({ title: d.error || "Failed to save", variant: "destructive" });
    }
    setAvailSubmitting(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </AppShell>
    );
  }

  const isActive = profile?.role === "ridechecker_active";
  const isPending = profile?.role === "ridechecker";

  // Partition assignments by status
  const pendingAcceptance = assignments.filter((a) => a.status === "awaiting_acceptance");
  const activeAssignments = assignments.filter((a) =>
    ["accepted", "in_progress", "submitted", "en_route", "arrived", "inspection_started", "photos_uploading", "report_pending", "escalated"].includes(a.status)
  );
  const pastAssignments = assignments.filter((a) =>
    ["approved", "paid", "declined", "expired", "cancelled", "rejected", "reassigned"].includes(a.status)
  );

  const next14Days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    next14Days.push(d.toISOString().split("T")[0]);
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
              RideChecker Dashboard
            </h1>
            <p className="text-muted-foreground text-sm">
              Welcome back, {profile?.full_name || "RideChecker"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadData(true)}
              disabled={refreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Badge variant={isActive ? "default" : "secondary"} data-testid="badge-status">
              {isActive ? "Active" : "Pending Approval"}
            </Badge>
          </div>
        </div>

        {/* ── Availability suspension banner ──────────────────────────── */}
        {isSuspended && suspendedUntil && (
          <Card className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
            <CardContent className="flex items-start gap-4 p-6">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1" data-testid="text-suspension-title">
                  Availability Temporarily Paused
                </h3>
                <p className="text-sm text-red-700 dark:text-red-400" data-testid="text-suspension-message">
                  Your RideChecker access has been temporarily paused due to repeated declined assignments.
                  Access restores automatically on{" "}
                  <strong>
                    {new Date(suspendedUntil).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </strong>.
                </p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                  Questions? Contact{" "}
                  <a href="mailto:support@ridecheckauto.com" className="underline">
                    support@ridecheckauto.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Pending approval notice ─────────────────────────────────── */}
        {isPending && (
          <Card>
            <CardContent className="flex items-start gap-4 p-6">
              <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Account Pending Approval</h3>
                <p className="text-sm text-muted-foreground">
                  Your application is being reviewed. Once approved, you'll receive and complete vehicle assessment jobs.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Inspection Availability Toggle ──────────────────────────── */}
        {isActive && (
          <Card className={isAvailable
            ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
            : "border-muted bg-muted/30"
          }>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-3 w-3 rounded-full flex-shrink-0 ${isAvailable ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm" data-testid="text-availability-label">
                      Inspection Availability
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-availability-status">
                      {isAvailable
                        ? "You are available for new RideCheck inspection assignments."
                        : "You are currently unavailable for new RideCheck assignments."}
                    </p>
                    {availabilityUpdatedAt && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Updated {formatRelative(availabilityUpdatedAt)}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isAvailable ? "outline" : "default"}
                  onClick={handleToggleAvailability}
                  disabled={availToggleLoading}
                  data-testid="button-toggle-availability"
                  className={isAvailable
                    ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                    : "bg-green-600 hover:bg-green-700 text-white"
                  }
                >
                  {availToggleLoading ? "Saving..." : isAvailable ? "Turn Unavailable" : "Turn Available"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── ACTION REQUIRED — always at top ─────────────────────────── */}
        {pendingAcceptance.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              <h2 className="font-bold text-amber-700 dark:text-amber-400" data-testid="heading-action-required">
                Action Required — {pendingAcceptance.length} Job Offer{pendingAcceptance.length > 1 ? "s" : ""}
              </h2>
            </div>
            {pendingAcceptance.map((a) => (
              <ActionRequiredCard
                key={a.id}
                assignment={a}
                onAccept={handleAccept}
                onDecline={handleDecline}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}

        {/* ── Active job flow ─────────────────────────────────────────── */}
        {activeAssignments.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Active Jobs</h2>
            {activeAssignments.map((a) => (
              <ActiveJobCard
                key={a.id}
                assignment={a}
                onStart={handleStart}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        {isActive && (
          <>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b" data-testid="tab-bar">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-md transition-colors ${
                    activeTab === tab.key
                      ? "text-primary border-b-2 border-primary -mb-px"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`tab-${tab.key}`}
                >
                  {tab.label}
                  {tab.key === "payouts" && payoutSummary.pending > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                      {payoutSummary.pending > 0 ? "$" : ""}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Overview */}
            {activeTab === "overview" && (
              <div className="space-y-4" data-testid="tab-content-overview">
                {/* Stats grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <SmallStatCard icon={Briefcase} label="Total Jobs" value={stats.totalJobs} testId="text-total-jobs" />
                  <SmallStatCard icon={Clock} label="Active" value={stats.activeJobs} testId="text-active-jobs" />
                  <SmallStatCard icon={CheckCircle2} label="Completed" value={stats.completedJobs} testId="text-completed-jobs" />
                  <SmallStatCard icon={ClipboardCheck} label="Needs Upload" value={stats.pendingUpload} testId="text-pending-upload" />
                </div>

                {/* Earnings snapshot */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-xs">Total Earned</span>
                      </div>
                      <p className="text-2xl font-bold" data-testid="text-total-earned">
                        ${payoutSummary.total_earned.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-yellow-200 dark:border-yellow-800">
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs">Pending Payout</span>
                      </div>
                      <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400" data-testid="text-pending-payout">
                        ${payoutSummary.pending.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 dark:border-green-800">
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs">Paid Out</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-paid-out">
                        ${payoutSummary.paid.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/ridechecker/jobs">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Car className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">My Jobs</p>
                          <p className="text-xs text-muted-foreground">View all assigned jobs</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                      </CardContent>
                    </Card>
                  </Link>
                  <button onClick={() => setActiveTab("payouts")} className="text-left">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">Pay History</p>
                          <p className="text-xs text-muted-foreground">{payouts.length} payout record{payouts.length !== 1 ? "s" : ""}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                      </CardContent>
                    </Card>
                  </button>
                </div>
              </div>
            )}

            {/* Jobs */}
            {activeTab === "jobs" && (
              <div className="space-y-4" data-testid="tab-content-jobs">
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <SmallStatCard icon={Briefcase} label="Total Jobs" value={stats.totalJobs} testId="text-total-jobs-tab" />
                  <SmallStatCard icon={Clock} label="Active" value={stats.activeJobs} testId="text-active-jobs-tab" />
                  <SmallStatCard icon={CheckCircle2} label="Completed" value={stats.completedJobs} testId="text-completed-jobs-tab" />
                  <SmallStatCard icon={ClipboardCheck} label="Needs Upload" value={stats.pendingUpload} testId="text-pending-upload-tab" />
                </div>

                {assignments.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Car className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-1">No Jobs Assigned</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        New jobs will appear here when they are assigned to you.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {pendingAcceptance.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Action Required</p>
                        {pendingAcceptance.map((a) => (
                          <AssignmentRow key={a.id} assignment={a} showCountdown />
                        ))}
                      </div>
                    )}
                    {activeAssignments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active</p>
                        {activeAssignments.map((a) => (
                          <AssignmentRow key={a.id} assignment={a} />
                        ))}
                      </div>
                    )}
                    {pastAssignments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Past</p>
                        {pastAssignments.map((a) => (
                          <AssignmentRow key={a.id} assignment={a} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Pay & Payouts */}
            {activeTab === "payouts" && (
              <div className="space-y-4" data-testid="tab-content-payouts">
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-xs">Total Earned</span>
                      </div>
                      <p className="text-2xl font-bold">${payoutSummary.total_earned.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs">Pending</span>
                      </div>
                      <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">${payoutSummary.pending.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs">Approved</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">${payoutSummary.approved.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
                        <CreditCard className="h-3.5 w-3.5" />
                        <span className="text-xs">Paid Out</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">${payoutSummary.paid.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Payout history */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      Pay History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {payouts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Wallet className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium">No payout records yet</p>
                        <p className="text-xs text-muted-foreground">Completed jobs will generate payout records.</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {payouts.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                            data-testid={`row-payout-${p.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {p.vehicle_label || `Order ${p.order_id.slice(0, 8).toUpperCase()}`}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                                {p.scheduled_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {p.scheduled_date}
                                  </span>
                                )}
                                {p.bonus > 0 && (
                                  <span className="text-green-600">+${p.bonus} bonus</span>
                                )}
                                <span>{formatRelative(p.created_at)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <p className="font-bold text-primary">${p.total_pay}</p>
                                <p className="text-[11px] text-muted-foreground">base ${p.base_pay}</p>
                              </div>
                              {payoutStatusBadge(p.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Referral section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Gift className="h-4 w-4 text-muted-foreground" />
                      Referral Program
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Refer a mechanic or technician. You both earn $100 when they complete 3 jobs within 30 days.
                    </p>
                    {referralCode && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">Your Code:</span>
                          <div className="flex items-center gap-1">
                            <Input readOnly value={referralCode} className="w-48 font-mono text-sm" data-testid="input-referral-code" />
                            <Button size="icon" variant="ghost" onClick={copyReferralCode} data-testid="button-copy-referral-code">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={copyReferralLink} data-testid="button-copy-referral-link">
                          <Copy className="h-3.5 w-3.5 mr-1" />Copy Referral Link
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="text-center">
                        <div className="text-lg font-bold">{referralStats.totalReferred}</div>
                        <div className="text-xs text-muted-foreground">Referred</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">{referralStats.pending}</div>
                        <div className="text-xs text-muted-foreground">In Progress</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">{referralStats.qualified}</div>
                        <div className="text-xs text-muted-foreground">Qualified</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">${referralStats.totalRewardEarned}</div>
                        <div className="text-xs text-muted-foreground">Earned</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Availability */}
            {activeTab === "availability" && (
              <div className="space-y-4" data-testid="tab-content-availability">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      Advanced Availability Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                        <Input type="date" value={availForm.date} onChange={(e) => setAvailForm((p) => ({ ...p, date: e.target.value }))} data-testid="input-avail-date" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
                        <Input type="time" value={availForm.start_time} onChange={(e) => setAvailForm((p) => ({ ...p, start_time: e.target.value }))} data-testid="input-avail-start" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">End Time</label>
                        <Input type="time" value={availForm.end_time} onChange={(e) => setAvailForm((p) => ({ ...p, end_time: e.target.value }))} data-testid="input-avail-end" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Max Jobs</label>
                        <select
                          className="flex min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={availForm.max_jobs}
                          onChange={(e) => setAvailForm((p) => ({ ...p, max_jobs: parseInt(e.target.value) }))}
                          data-testid="select-avail-max-jobs"
                        >
                          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <Button onClick={handleAddAvailability} disabled={availSubmitting} className="w-full" data-testid="button-add-availability">
                        {availSubmitting ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      Next 14 Days
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {next14Days.map((dateStr) => {
                        const slot = availability.find((a) => a.date === dateStr);
                        const dayLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                        return (
                          <div
                            key={dateStr}
                            className={`flex items-center justify-between gap-2 py-2 px-3 rounded-md ${slot ? "bg-muted/50" : ""}`}
                            data-testid={`avail-day-${dateStr}`}
                          >
                            <span className="text-sm font-medium min-w-[120px]">{dayLabel}</span>
                            {slot ? (
                              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                <span>{slot.start_time} – {slot.end_time}</span>
                                <Badge variant="secondary">Max {slot.max_jobs}</Badge>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not set</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Training */}
            {activeTab === "training" && (
              <div className="space-y-4" data-testid="tab-content-training">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <GraduationCap className="h-12 w-12 text-primary mb-4" />
                    <h3 className="font-semibold mb-1">RideChecker Basic Certification</h3>
                    {profile?.training_sip4_completed ? (
                      <>
                        <p className="text-sm text-emerald-600 font-medium mb-3">✓ Module 1 — Certified</p>
                        <p className="text-sm text-muted-foreground max-w-sm mb-4">
                          You have completed Module 1: Standardized Vehicle Assessment Protocol.
                        </p>
                        <a href="/ridechecker/training" className="text-sm text-primary underline" data-testid="link-review-training">
                          Review training material
                        </a>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground max-w-sm mb-4">
                          Complete Module 1 to unlock vehicle assessment forms. Pass the knowledge check (80%) to become certified.
                        </p>
                        <a
                          href="/ridechecker/training"
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                          data-testid="link-start-training"
                        >
                          <GraduationCap className="h-4 w-4" />
                          Start Certification
                        </a>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SmallStatCard({ icon: Icon, label, value, testId }: { icon: any; label: string; value: number; testId: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-bold" data-testid={testId}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ActionRequiredCard({
  assignment,
  onAccept,
  onDecline,
  actionLoading,
}: {
  assignment: Assignment;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  actionLoading: string | null;
}) {
  const isLoading = actionLoading === assignment.id;
  const vehicle = [assignment.vehicle_year, assignment.vehicle_make, assignment.vehicle_model].filter(Boolean).join(" ") || "Vehicle TBD";
  const pay = assignment.payout_amount ?? (assignment as any).pay_amount;

  return (
    <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Zap className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span className="font-semibold" data-testid={`text-action-vehicle-${assignment.id}`}>{vehicle}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-muted-foreground">
              {(assignment.inspection_address || assignment.vehicle_location) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {assignment.inspection_address || assignment.vehicle_location}
                </span>
              )}
              {assignment.scheduled_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {assignment.scheduled_date}
                </span>
              )}
              {pay != null && (
                <span className="flex items-center gap-1 font-semibold text-green-700 dark:text-green-400">
                  <DollarSign className="h-3.5 w-3.5" />${pay} offered
                </span>
              )}
            </div>
          </div>
          <CountdownBadge expiresAt={assignment.expires_at} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/ridechecker/jobs/${assignment.id}`}>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1" data-testid={`button-view-job-${assignment.id}`}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              View &amp; Respond
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => onDecline(assignment.id)}
            disabled={isLoading}
            data-testid={`button-decline-quick-${assignment.id}`}
          >
            {isLoading ? "..." : "Decline"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveJobCard({
  assignment,
  onStart,
  actionLoading,
}: {
  assignment: Assignment;
  onStart: (id: string) => void;
  actionLoading: string | null;
}) {
  const isLoading = actionLoading === assignment.id;
  const vehicle = [assignment.vehicle_year, assignment.vehicle_make, assignment.vehicle_model].filter(Boolean).join(" ") || "Vehicle TBD";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{vehicle}</span>
              <Badge variant={assignmentBadgeVariant(assignment.status)}>{formatStatus(assignment.status)}</Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {(assignment.inspection_address || assignment.vehicle_location) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {assignment.inspection_address || assignment.vehicle_location}
                </span>
              )}
              {assignment.scheduled_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {assignment.scheduled_date}
                  {assignment.scheduled_time ? ` at ${assignment.scheduled_time}` : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {assignment.status === "accepted" && (
              <Button size="sm" variant="secondary" onClick={() => onStart(assignment.id)} disabled={isLoading} data-testid={`button-start-${assignment.id}`}>
                <Play className="h-3.5 w-3.5 mr-1" />
                {isLoading ? "..." : "Start"}
              </Button>
            )}
            {assignment.status === "in_progress" && (
              <Link href={`/ridechecker/jobs/${assignment.id}/submit`}>
                <Button size="sm" variant="outline" data-testid={`button-continue-${assignment.id}`}>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Continue
                </Button>
              </Link>
            )}
            {assignment.status === "submitted" && (
              <Badge variant="outline" data-testid={`badge-awaiting-${assignment.id}`}>Awaiting Review</Badge>
            )}
            <Link href={`/ridechecker/jobs/${assignment.id}`}>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AssignmentRow({ assignment, showCountdown = false }: { assignment: Assignment; showCountdown?: boolean }) {
  const vehicle = [assignment.vehicle_year, assignment.vehicle_make, assignment.vehicle_model].filter(Boolean).join(" ") || "Vehicle TBD";

  return (
    <Link href={`/ridechecker/jobs/${assignment.id}`} data-testid={`link-assignment-row-${assignment.id}`}>
      <Card className="hover:shadow-sm transition-shadow cursor-pointer">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{vehicle}</span>
                <Badge variant={assignmentBadgeVariant(assignment.status)} className="text-xs">
                  {formatStatus(assignment.status)}
                </Badge>
                {showCountdown && <CountdownBadge expiresAt={assignment.expires_at} />}
              </div>
              {(assignment.inspection_address || assignment.vehicle_location || assignment.scheduled_date) && (
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  {(assignment.inspection_address || assignment.vehicle_location) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {assignment.inspection_address || assignment.vehicle_location}
                    </span>
                  )}
                  {assignment.scheduled_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {assignment.scheduled_date}
                    </span>
                  )}
                </div>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
