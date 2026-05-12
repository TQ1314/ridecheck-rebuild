"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Car,
  MapPin,
  Calendar,
  AlertCircle,
  ChevronRight,
  Clock,
  DollarSign,
  Zap,
} from "lucide-react";

interface Assignment {
  id: string;
  order_id: string;
  status: string;
  payout_amount?: number;
  expires_at?: string | null;
  created_at: string;
  order?: {
    vehicle_year?: string;
    vehicle_make?: string;
    vehicle_model?: string;
    inspection_address?: string;
    vehicle_location?: string;
    scheduled_date?: string;
    scheduled_time?: string;
    package?: string;
    base_pay?: number;
    current_offer?: number;
  } | null;
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

function CountdownPill({ expiresAt }: { expiresAt: string | null | undefined }) {
  const secs = useCountdown(expiresAt);
  if (secs === null || !expiresAt) return null;
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  const urgent = secs < 180; // < 3 min
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
        secs === 0
          ? "bg-gray-100 text-gray-500"
          : urgent
          ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      <Clock className="h-3 w-3" />
      {secs === 0 ? "Expired" : `${mins}m ${s < 10 ? "0" : ""}${s}s`}
    </span>
  );
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "approved":
    case "paid":
    case "completed":
    case "accepted":
      return "default";
    case "in_progress":
    case "submitted":
    case "en_route":
    case "on_site":
    case "inspecting":
      return "secondary";
    case "declined":
    case "rejected":
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}

function formatStatus(status: string): string {
  if (!status) return "Pending";
  const labels: Record<string, string> = {
    awaiting_acceptance: "Action Required",
    accepted: "Accepted",
    declined: "Declined",
    expired: "Expired",
    in_progress: "In Progress",
  };
  return labels[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const order = assignment.order;
  const vehicle = order
    ? `${order.vehicle_year || ""} ${order.vehicle_make || ""} ${order.vehicle_model || ""}`.trim()
    : "Vehicle TBD";
  const address = order?.inspection_address || order?.vehicle_location || "TBD";
  const pay = assignment.payout_amount ?? order?.current_offer ?? order?.base_pay;
  const isPending = assignment.status === "awaiting_acceptance";

  return (
    <Link href={`/ridechecker/jobs/${assignment.id}`} data-testid={`link-assignment-${assignment.id}`}>
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          isPending
            ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20"
            : "hover-elevate"
        }`}
      >
        <CardContent className="p-4">
          {isPending && (
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-amber-200 dark:border-amber-700">
              <Zap className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex-1">
                Response required
              </span>
              <CountdownPill expiresAt={assignment.expires_at} />
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="font-semibold truncate"
                  data-testid={`text-assignment-vehicle-${assignment.id}`}
                >
                  {vehicle}
                </span>
                {!isPending && (
                  <Badge
                    variant={statusBadgeVariant(assignment.status)}
                    data-testid={`badge-assignment-status-${assignment.id}`}
                  >
                    {formatStatus(assignment.status)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate max-w-[180px]">{address}</span>
                </span>
                {order?.scheduled_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {order.scheduled_date}
                    {order.scheduled_time ? ` at ${order.scheduled_time}` : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {order?.package && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {order.package} Package
                  </span>
                )}
                {pay != null && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400">
                    <DollarSign className="h-3 w-3" />
                    {pay} offered
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
          </div>
          {isPending && (
            <div className="mt-3 pt-2">
              <Button
                size="sm"
                className="w-full text-sm bg-green-600 hover:bg-green-700 text-white"
                data-testid={`button-view-accept-${assignment.id}`}
              >
                View & Respond to Job Offer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function RideCheckerJobsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [legacyJobs, setLegacyJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
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

    try {
      const res = await fetch("/api/ridechecker/jobs");
      if (res.ok) {
        const data = await res.json();
        if (data.assignments) setAssignments(data.assignments);
        if (data.jobs) setLegacyJobs(data.jobs);
      }
    } catch {}

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    load();
  }, [load]);

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

  const pendingAcceptance = assignments.filter((a) => a.status === "awaiting_acceptance");
  const activeAssignments = assignments.filter((a) =>
    ["assigned", "accepted", "in_progress", "submitted"].includes(a.status)
  );
  const pastAssignments = assignments.filter((a) =>
    ["approved", "paid", "declined", "expired", "cancelled", "rejected"].includes(a.status)
  );

  const hasWork = assignments.length > 0 || legacyJobs.length > 0;

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-jobs-title">
            My Jobs
          </h1>
          <p className="text-muted-foreground">Assigned vehicle assessment jobs</p>
        </div>

        {isPending && (
          <Card>
            <CardContent className="flex items-start gap-4 p-6">
              <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Account Pending Approval</h3>
                <p className="text-sm text-muted-foreground">
                  You will be able to see assigned jobs once your account is activated by the
                  RideCheck team.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isActive && !hasWork && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Car className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No Jobs Assigned</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                New jobs will appear here when they are assigned to you.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Action Required ───────────────────────────────── */}
        {isActive && pendingAcceptance.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              <h2 className="font-bold text-amber-700 dark:text-amber-400" data-testid="heading-action-required">
                Action Required ({pendingAcceptance.length})
              </h2>
            </div>
            <p className="text-sm text-muted-foreground -mt-1">
              You have a limited window to accept or decline these job offers.
            </p>
            {pendingAcceptance.map((a) => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}

        {/* ── Active / In Progress ──────────────────────────── */}
        {isActive && activeAssignments.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Active Jobs
            </h2>
            {activeAssignments.map((a) => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}

        {/* ── Legacy jobs ───────────────────────────────────── */}
        {isActive && legacyJobs.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Other Jobs
            </h2>
            {legacyJobs.map((job) => (
              <Card
                key={job.order_id}
                className="hover-elevate"
                data-testid={`card-legacy-job-${job.order_id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-semibold"
                          data-testid={`text-job-vehicle-${job.order_id}`}
                        >
                          {job.vehicle_year} {job.vehicle_make} {job.vehicle_model}
                        </span>
                        <Badge variant={statusBadgeVariant(job.inspector_status)}>
                          {formatStatus(job.inspector_status)}
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
                    <Badge variant="outline">{job.package}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Past ─────────────────────────────────────────── */}
        {isActive && pastAssignments.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Past Jobs
            </h2>
            {pastAssignments.map((a) => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
