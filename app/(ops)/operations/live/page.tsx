"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  MapPin,
  Navigation,
  CheckCircle2,
  Clock,
  Camera,
  ClipboardList,
  RefreshCw,
  Loader2,
  ArrowLeft,
  UserX,
} from "lucide-react";
import { formatRelative } from "@/lib/utils/format";

interface ActiveJob {
  assignment_id: string;
  order_id: string;
  order_ref: string | null;
  vehicle: string | null;
  inspection_address: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  ridechecker_id: string | null;
  ridechecker_name: string;
  ridechecker_phone: string | null;
  status: string;
  status_since: string | null;
  last_known_lat: number | null;
  last_known_lng: number | null;
  last_location_update_at: string | null;
  escalation_notes: string | null;
  is_bottleneck: boolean;
  bottleneck_reason: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  awaiting_acceptance: {
    label: "Awaiting",
    badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
    icon: <Clock className="h-3 w-3" />,
  },
  assigned: {
    label: "Assigned",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Clock className="h-3 w-3" />,
  },
  accepted: {
    label: "Accepted",
    badge: "bg-green-100 text-green-800 border-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  en_route: {
    label: "En Route",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    icon: <Navigation className="h-3 w-3" />,
  },
  arrived: {
    label: "Arrived",
    badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: <MapPin className="h-3 w-3" />,
  },
  inspection_started: {
    label: "Inspecting",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <ClipboardList className="h-3 w-3" />,
  },
  in_progress: {
    label: "In Progress",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Activity className="h-3 w-3" />,
  },
  photos_uploading: {
    label: "Uploading",
    badge: "bg-cyan-100 text-cyan-800 border-cyan-200",
    icon: <Camera className="h-3 w-3" />,
  },
  report_pending: {
    label: "Report Pending",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <ClipboardList className="h-3 w-3" />,
  },
  escalated: {
    label: "Escalated",
    badge: "bg-red-100 text-red-800 border-red-200",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function timeSince(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
}

export default function LiveBoardPage() {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/ops/live-board");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.active_jobs ?? []);
        setLastRefresh(new Date());
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Auto-refresh every 60 s
  useEffect(() => {
    const id = setInterval(() => fetchJobs(true), 60000);
    return () => clearInterval(id);
  }, [fetchJobs]);

  const bottlenecks = jobs.filter((j) => j.is_bottleneck || j.status === "escalated");

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-5 max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/operations">
            <Button size="icon" variant="ghost" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">Live Inspection Board</h1>
            <p className="text-sm text-muted-foreground">
              Real-time status for all active RideChecker jobs
              {lastRefresh && (
                <span className="ml-2">· refreshed {timeSince(lastRefresh.toISOString())}</span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchJobs(true)}
            disabled={refreshing}
            data-testid="button-refresh-live-board"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Bottleneck Alerts */}
        {bottlenecks.length > 0 && (
          <div className="space-y-2">
            {bottlenecks.map((j) => (
              <div
                key={j.assignment_id}
                className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                data-testid={`alert-bottleneck-${j.assignment_id}`}
              >
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    {j.ridechecker_name} — {j.order_ref ?? j.order_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500">
                    {j.status === "escalated" && j.escalation_notes
                      ? j.escalation_notes
                      : j.bottleneck_reason ?? "Needs attention"}
                  </p>
                </div>
                <Link href={`/operations/orders/${j.order_id}`}>
                  <Button size="sm" variant="destructive" className="shrink-0" data-testid={`button-view-order-${j.assignment_id}`}>
                    View Order
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Jobs", value: jobs.length, color: "text-primary" },
            { label: "En Route", value: jobs.filter((j) => j.status === "en_route").length, color: "text-purple-600" },
            { label: "Inspecting", value: jobs.filter((j) => ["arrived", "inspection_started", "in_progress", "photos_uploading"].includes(j.status)).length, color: "text-blue-600" },
            { label: "Alerts", value: bottlenecks.length, color: "text-red-600" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="text-center py-3">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </Card>
          ))}
        </div>

        {/* Main Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Active Jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                <p className="text-sm">No active jobs right now</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2.5">RideChecker</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2.5">Order / Vehicle</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2.5">Status</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2.5">Location</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2.5">Last Update</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {jobs.map((job) => {
                      const cfg = STATUS_CONFIG[job.status];
                      const isAlert = job.is_bottleneck || job.status === "escalated";
                      return (
                        <tr
                          key={job.assignment_id}
                          className={`hover:bg-muted/30 transition-colors ${isAlert ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}
                          data-testid={`row-job-${job.assignment_id}`}
                        >
                          {/* RC Name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isAlert && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                              <div>
                                <p className="font-medium" data-testid={`text-rc-${job.assignment_id}`}>
                                  {job.ridechecker_name}
                                </p>
                                {job.ridechecker_phone && (
                                  <p className="text-xs text-muted-foreground">{job.ridechecker_phone}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Order / Vehicle */}
                          <td className="px-4 py-3">
                            <p className="font-medium text-primary">
                              {job.order_ref ?? job.order_id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                              {job.vehicle ?? "—"}
                            </p>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            {cfg ? (
                              <Badge className={`flex items-center gap-1 w-fit text-xs border ${cfg.badge}`} data-testid={`badge-status-${job.assignment_id}`}>
                                {cfg.icon}
                                {cfg.label}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs capitalize">
                                {job.status.replace(/_/g, " ")}
                              </Badge>
                            )}
                            {job.status_since && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                since {timeSince(job.status_since)}
                              </p>
                            )}
                          </td>

                          {/* GPS */}
                          <td className="px-4 py-3">
                            {job.last_known_lat != null && job.last_known_lng != null ? (
                              <a
                                href={mapsUrl(job.last_known_lat, job.last_known_lng)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                                data-testid={`link-map-${job.assignment_id}`}
                              >
                                <MapPin className="h-3 w-3" />
                                View Map
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">No GPS</span>
                            )}
                          </td>

                          {/* Last Update */}
                          <td className="px-4 py-3 text-xs text-muted-foreground" data-testid={`text-last-update-${job.assignment_id}`}>
                            {timeSince(job.status_since)}
                          </td>

                          {/* Action */}
                          <td className="px-4 py-3">
                            <Link href={`/operations/orders/${job.order_id}`}>
                              <Button size="sm" variant="outline" className="text-xs h-7" data-testid={`button-order-${job.assignment_id}`}>
                                View Order
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
