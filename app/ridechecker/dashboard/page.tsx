"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  pendingUpload: number;
}

interface EarningsSummary {
  totalEarned: number;
  pendingPayout: number;
  paidOut: number;
  totalJobs: number;
}

interface ReferralStats {
  totalReferred: number;
  qualified: number;
  pending: number;
  totalRewardEarned: number;
}

interface Job {
  order_id: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_location: string;
  inspection_address: string;
  scheduled_date: string;
  scheduled_time: string;
  inspector_status: string;
  report_status: string;
  package: string;
}

interface Assignment {
  id: string;
  order_id: string;
  status: string;
  score?: number;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_location?: string;
  inspection_address?: string;
  scheduled_date?: string;
  scheduled_time?: string;
}

interface AvailabilitySlot {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
  max_jobs: number;
}

type TabKey = "jobs" | "availability" | "earnings" | "kudos" | "training";

const TABS: { key: TabKey; label: string }[] = [
  { key: "availability", label: "Availability" },
  { key: "jobs", label: "My Jobs" },
  { key: "earnings", label: "Earnings" },
  { key: "kudos", label: "Kudos" },
  { key: "training", label: "Training" },
];

function formatStatus(status: string): string {
  if (!status) return "Pending";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "completed":
    case "approved":
    case "paid":
      return "default";
    case "in_progress":
    case "accepted":
      return "secondary";
    case "submitted":
      return "outline";
    default:
      return "outline";
  }
}

export default function RideCheckerDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<TabKey>("jobs");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    pendingUpload: 0,
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [earnings, setEarnings] = useState<EarningsSummary>({
    totalEarned: 0,
    pendingPayout: 0,
    paidOut: 0,
    totalJobs: 0,
  });
  const [referralCode, setReferralCode] = useState("");
  const [referralStats, setReferralStats] = useState<ReferralStats>({
    totalReferred: 0,
    qualified: 0,
    pending: 0,
    totalRewardEarned: 0,
  });

  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availForm, setAvailForm] = useState({
    date: "",
    start_time: "09:00",
    end_time: "17:00",
    max_jobs: 3,
  });
  const [availSubmitting, setAvailSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (prof) setProfile(prof);

      const fetchJobs = fetch("/api/ridechecker/jobs").then((r) => r.ok ? r.json() : null);
      const fetchEarnings = fetch("/api/ridechecker/earnings").then((r) => r.ok ? r.json() : null);
      const fetchReferrals = fetch("/api/ridechecker/referrals").then((r) => r.ok ? r.json() : null);
      const fetchAvailability = fetch("/api/ridechecker/availability").then((r) => r.ok ? r.json() : null);

      const [jobsData, earningsData, referralsData, availData] = await Promise.all([
        fetchJobs.catch(() => null),
        fetchEarnings.catch(() => null),
        fetchReferrals.catch(() => null),
        fetchAvailability.catch(() => null),
      ]);

      if (jobsData?.stats) setStats(jobsData.stats);
      if (jobsData?.jobs) setJobs(jobsData.jobs);
      if (jobsData?.assignments) setAssignments(jobsData.assignments);
      if (earningsData?.summary) setEarnings(earningsData.summary);
      if (referralsData) {
        if (referralsData.referralCode) setReferralCode(referralsData.referralCode);
        if (referralsData.stats) setReferralStats(referralsData.stats);
      }
      if (availData?.availability) setAvailability(availData.availability);

      setLoading(false);
    }
    load();
  }, []);

  const copyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      toast({ title: "Referral code copied!" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const copyReferralLink = async () => {
    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${appUrl}/ridechecker/signup?ref=${referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Referral link copied!" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleAcceptJob = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/accept`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Job accepted!" });
        setAssignments((prev) =>
          prev.map((a) => (a.id === assignmentId ? { ...a, status: "accepted" } : a))
        );
      } else {
        const data = await res.json();
        toast({ title: data.error || "Failed to accept job", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to accept job", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleStartJob = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/start`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Job started!" });
        setAssignments((prev) =>
          prev.map((a) => (a.id === assignmentId ? { ...a, status: "in_progress" } : a))
        );
      } else {
        const data = await res.json();
        toast({ title: data.error || "Failed to start job", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to start job", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleAddAvailability = async () => {
    if (!availForm.date) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }
    setAvailSubmitting(true);
    try {
      const res = await fetch("/api/ridechecker/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: availForm.date,
          start_time: availForm.start_time,
          end_time: availForm.end_time,
          max_jobs: availForm.max_jobs,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Availability saved!" });
        if (data.availability) {
          setAvailability((prev) => {
            const filtered = prev.filter((a) => a.date !== data.availability.date);
            return [...filtered, data.availability].sort((a, b) => a.date.localeCompare(b.date));
          });
        }
        setAvailForm({ date: "", start_time: "09:00", end_time: "17:00", max_jobs: 3 });
      } else {
        const data = await res.json();
        toast({ title: data.error || "Failed to save availability", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save availability", variant: "destructive" });
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

  const allJobs = jobs.map((j) => {
    const match = assignments.find((a) => a.order_id === j.order_id);
    return {
      ...j,
      assignmentId: match?.id,
      assignmentStatus: match?.status || null,
      score: match?.score,
    };
  });

  const standAloneAssignments = assignments.filter(
    (a) => !jobs.some((j) => j.order_id === a.order_id)
  );

  const next14Days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    next14Days.push(d.toISOString().split("T")[0]);
  }

  function renderJobAction(assignmentId: string | undefined, assignmentStatus: string | null, score?: number) {
    if (!assignmentId || !assignmentStatus) return null;

    const isLoading = actionLoading === assignmentId;

    switch (assignmentStatus) {
      case "assigned":
        return (
          <Button
            size="sm"
            onClick={() => handleAcceptJob(assignmentId)}
            disabled={isLoading}
            data-testid={`button-accept-job-${assignmentId}`}
          >
            {isLoading ? "..." : "Accept Job"}
          </Button>
        );
      case "accepted":
        return (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleStartJob(assignmentId)}
            disabled={isLoading}
            data-testid={`button-start-job-${assignmentId}`}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            {isLoading ? "..." : "Start Job"}
          </Button>
        );
      case "in_progress":
        return (
          <Link href={`/ridechecker/jobs/${assignmentId}/submit`}>
            <Button size="sm" variant="outline" data-testid={`button-submit-data-${assignmentId}`}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Submit Raw Data
            </Button>
          </Link>
        );
      case "submitted":
        return <Badge variant="outline" data-testid={`badge-awaiting-review-${assignmentId}`}>Awaiting Review</Badge>;
      case "approved":
      case "paid":
        return (
          <Badge variant="default" data-testid={`badge-completed-${assignmentId}`}>
            Completed{score != null ? ` (${score})` : ""}
          </Badge>
        );
      default:
        return null;
    }
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
              RideChecker Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name || "RideChecker"}
            </p>
          </div>
          <Badge
            variant={isActive ? "default" : "secondary"}
            data-testid="badge-status"
          >
            {isActive ? "Active" : "Pending Approval"}
          </Badge>
        </div>

        {isPending && (
          <Card>
            <CardContent className="flex items-start gap-4 p-6">
              <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Account Pending Approval</h3>
                <p className="text-sm text-muted-foreground">
                  Your RideChecker application is being reviewed. Once approved,
                  you will be able to receive and complete vehicle assessment
                  jobs. We will notify you when your account is activated.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isPending && referralCode && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-muted-foreground" />
                Your Referral Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Share your referral code even while your account is pending. Once both of you are active and your referral completes 3 jobs in 30 days, you each earn $100.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  readOnly
                  value={referralCode}
                  className="w-48 font-mono text-sm"
                  data-testid="input-referral-code-pending"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={copyReferralCode}
                  data-testid="button-copy-referral-pending"
                  title="Copy code"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isActive && (
          <>
            <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="tab-bar">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  data-testid={`tab-${tab.key}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "jobs" && (
              <div className="space-y-4" data-testid="tab-content-jobs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Jobs
                      </CardTitle>
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-jobs">
                        {stats.totalJobs}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Active
                      </CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-active-jobs">
                        {stats.activeJobs}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Completed
                      </CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-completed-jobs">
                        {stats.completedJobs}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Needs Upload
                      </CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-pending-upload">
                        {stats.pendingUpload}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {allJobs.length === 0 && standAloneAssignments.length === 0 && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Car className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-1">No Jobs Assigned</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        You don't have any assessment jobs assigned yet. New jobs will
                        appear here when they are assigned to you.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {allJobs.length > 0 && (
                  <div className="space-y-3">
                    {allJobs.map((job) => (
                      <Card key={job.order_id} data-testid={`card-job-${job.order_id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between flex-wrap gap-3">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold" data-testid={`text-job-vehicle-${job.order_id}`}>
                                  {job.vehicle_year} {job.vehicle_make} {job.vehicle_model}
                                </span>
                                <Badge
                                  variant={statusBadgeVariant(job.assignmentStatus || job.inspector_status)}
                                  data-testid={`badge-job-status-${job.order_id}`}
                                >
                                  {formatStatus(job.assignmentStatus || job.inspector_status)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {job.inspection_address || job.vehicle_location || "TBD"}
                                </span>
                                {job.scheduled_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {job.scheduled_date}
                                    {job.scheduled_time ? ` at ${job.scheduled_time}` : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {renderJobAction(job.assignmentId, job.assignmentStatus, job.score)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {standAloneAssignments.length > 0 && (
                  <div className="space-y-3">
                    {standAloneAssignments.map((a) => (
                      <Card key={a.id} data-testid={`card-assignment-${a.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between flex-wrap gap-3">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold" data-testid={`text-assignment-vehicle-${a.id}`}>
                                  {a.vehicle_year || ""} {a.vehicle_make || ""} {a.vehicle_model || ""}
                                  {!a.vehicle_year && !a.vehicle_make ? `Assignment ${a.id.slice(0, 8)}` : ""}
                                </span>
                                <Badge
                                  variant={statusBadgeVariant(a.status)}
                                  data-testid={`badge-assignment-status-${a.id}`}
                                >
                                  {formatStatus(a.status)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                {(a.inspection_address || a.vehicle_location) && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {a.inspection_address || a.vehicle_location}
                                  </span>
                                )}
                                {a.scheduled_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {a.scheduled_date}
                                    {a.scheduled_time ? ` at ${a.scheduled_time}` : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {renderJobAction(a.id, a.status, a.score)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "availability" && (
              <div className="space-y-4" data-testid="tab-content-availability">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      Add Availability
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                        <Input
                          type="date"
                          value={availForm.date}
                          onChange={(e) => setAvailForm((p) => ({ ...p, date: e.target.value }))}
                          data-testid="input-avail-date"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
                        <Input
                          type="time"
                          value={availForm.start_time}
                          onChange={(e) => setAvailForm((p) => ({ ...p, start_time: e.target.value }))}
                          data-testid="input-avail-start"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">End Time</label>
                        <Input
                          type="time"
                          value={availForm.end_time}
                          onChange={(e) => setAvailForm((p) => ({ ...p, end_time: e.target.value }))}
                          data-testid="input-avail-end"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Max Jobs</label>
                        <select
                          className="flex min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={availForm.max_jobs}
                          onChange={(e) => setAvailForm((p) => ({ ...p, max_jobs: parseInt(e.target.value) }))}
                          data-testid="select-avail-max-jobs"
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Button
                          onClick={handleAddAvailability}
                          disabled={availSubmitting}
                          className="w-full"
                          data-testid="button-add-availability"
                        >
                          {availSubmitting ? "Saving..." : "Add"}
                        </Button>
                      </div>
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
                    <div className="space-y-2">
                      {next14Days.map((dateStr) => {
                        const slot = availability.find((a) => a.date === dateStr);
                        const dayLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        });
                        return (
                          <div
                            key={dateStr}
                            className={`flex items-center justify-between flex-wrap gap-2 py-2 px-3 rounded-md ${slot ? "bg-muted/50" : ""}`}
                            data-testid={`avail-day-${dateStr}`}
                          >
                            <span className="text-sm font-medium min-w-[120px]">{dayLabel}</span>
                            {slot ? (
                              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                <span>{slot.start_time} - {slot.end_time}</span>
                                <Badge variant="secondary">Max {slot.max_jobs} job{slot.max_jobs > 1 ? "s" : ""}</Badge>
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

            {activeTab === "earnings" && (
              <div className="space-y-4" data-testid="tab-content-earnings">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Earned
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-earned">
                        ${earnings.totalEarned.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Pending Payout
                      </CardTitle>
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-pending-payout">
                        ${earnings.pendingPayout.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Paid Out
                      </CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-paid-out">
                        ${earnings.paidOut.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

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
                            <Input
                              readOnly
                              value={referralCode}
                              className="w-48 font-mono text-sm"
                              data-testid="input-referral-code-display"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={copyReferralCode}
                              data-testid="button-copy-referral-code"
                              title="Copy code"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyReferralLink}
                          data-testid="button-copy-referral-link"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy Referral Link
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="text-center">
                        <div className="text-lg font-bold" data-testid="text-referral-total">
                          {referralStats.totalReferred}
                        </div>
                        <div className="text-xs text-muted-foreground">Referred</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold" data-testid="text-referral-pending">
                          {referralStats.pending}
                        </div>
                        <div className="text-xs text-muted-foreground">In Progress</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold" data-testid="text-referral-qualified">
                          {referralStats.qualified}
                        </div>
                        <div className="text-xs text-muted-foreground">Qualified</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold" data-testid="text-referral-reward">
                          ${referralStats.totalRewardEarned}
                        </div>
                        <div className="text-xs text-muted-foreground">Reward Earned</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "kudos" && (
              <div className="space-y-4" data-testid="tab-content-kudos">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Star className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-1">Kudos</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Internal feedback from the Ops team will appear here.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "training" && (
              <div className="space-y-4" data-testid="tab-content-training">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-1">Training</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Training materials and resources coming soon.
                    </p>
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
