"use client";

import { useState, useEffect, useCallback } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Camera,
  ClipboardList,
  Loader2,
  RefreshCw,
  UserX,
  MessageSquare,
} from "lucide-react";
import { formatRelative } from "@/lib/utils/format";

interface RideChecker {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

interface Assignment {
  id: string;
  order_id: string;
  ridechecker_id: string;
  status: string;
  accepted_at: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  inspection_started_at: string | null;
  photos_uploading_at: string | null;
  report_pending_at: string | null;
  escalated_at: string | null;
  last_status_update_at: string | null;
  last_known_lat: number | null;
  last_known_lng: number | null;
  last_location_update_at: string | null;
  delay_notes: string | null;
  escalation_notes: string | null;
  rejection_reason: string | null;
  declined_at: string | null;
  ridechecker: RideChecker | null;
}

interface StatusLogEntry {
  old_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
}

interface JobStatusPanelProps {
  order: Order;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  awaiting_acceptance: {
    label: "Awaiting Acceptance",
    color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  assigned: {
    label: "Assigned",
    color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  accepted: {
    label: "Accepted",
    color: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  en_route: {
    label: "En Route",
    color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
    icon: <Navigation className="h-3.5 w-3.5" />,
  },
  arrived: {
    label: "Arrived",
    color: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300",
    icon: <MapPin className="h-3.5 w-3.5" />,
  },
  inspection_started: {
    label: "Inspection Started",
    color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    icon: <ClipboardList className="h-3.5 w-3.5" />,
  },
  photos_uploading: {
    label: "Uploading Photos",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300",
    icon: <Camera className="h-3.5 w-3.5" />,
  },
  report_pending: {
    label: "Report Pending",
    color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300",
    icon: <ClipboardList className="h-3.5 w-3.5" />,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    icon: <Activity className="h-3.5 w-3.5" />,
  },
  submitted: {
    label: "Submitted",
    color: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  escalated: {
    label: "Escalated",
    color: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  declined: {
    label: "Declined",
    color: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300",
    icon: <UserX className="h-3.5 w-3.5" />,
  },
};

const MILESTONES = [
  { status: "accepted",           label: "Accepted",           key: "accepted_at" },
  { status: "en_route",           label: "En Route",           key: "en_route_at" },
  { status: "arrived",            label: "Arrived",            key: "arrived_at" },
  { status: "inspection_started", label: "Inspection Started", key: "inspection_started_at" },
  { status: "photos_uploading",   label: "Photos Uploading",   key: "photos_uploading_at" },
  { status: "report_pending",     label: "Report Pending",     key: "report_pending_at" },
  { status: "submitted",          label: "Submitted",          key: "submitted_at" },
] as const;

const STATUS_ORDER = [
  "awaiting_acceptance", "assigned", "accepted", "en_route", "arrived",
  "inspection_started", "in_progress", "photos_uploading", "report_pending",
  "submitted", "approved", "paid",
];

function statusIndex(s: string) {
  const idx = STATUS_ORDER.indexOf(s);
  return idx === -1 ? -1 : idx;
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function JobStatusPanel({ order, onRefresh }: JobStatusPanelProps) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [statusLog, setStatusLog] = useState<StatusLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/job-status`);
      if (res.ok) {
        const data = await res.json();
        setAssignment(data.assignment);
        setStatusLog(data.status_log ?? []);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [order.id]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Auto-refresh every 60 s when there's an active assignment
  useEffect(() => {
    if (!assignment) return;
    const DONE = ["submitted", "approved", "paid", "declined", "expired", "cancelled", "rejected"];
    if (DONE.includes(assignment.status)) return;
    const id = setInterval(() => fetchStatus(true), 60000);
    return () => clearInterval(id);
  }, [assignment, fetchStatus]);

  const cfg = assignment ? (STATUS_CONFIG[assignment.status] ?? null) : null;
  const curIdx = assignment ? statusIndex(assignment.status) : -1;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Live Job Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!assignment) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Live Job Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-3">
            No active assignment yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isBottleneck = (() => {
    const thresholds: Record<string, { minutes: number; reason: string }> = {
      accepted:           { minutes: 120,  reason: "Accepted but no movement in 2 hours" },
      en_route:           { minutes: 90,   reason: "En route for over 90 minutes" },
      arrived:            { minutes: 20,   reason: "Arrived but inspection not started" },
      inspection_started: { minutes: 150,  reason: "Inspection running over 2.5 hours" },
      photos_uploading:   { minutes: 60,   reason: "Photo upload taking over 1 hour" },
      report_pending:     { minutes: 1440, reason: "Report pending for over 24 hours" },
    };
    const t = thresholds[assignment.status];
    if (!t) return null;
    const colMap: Record<string, keyof Assignment> = {
      en_route: "en_route_at", arrived: "arrived_at",
      inspection_started: "inspection_started_at",
      photos_uploading: "photos_uploading_at",
      report_pending: "report_pending_at", escalated: "escalated_at",
    };
    const ref = (colMap[assignment.status] ? assignment[colMap[assignment.status]] as string | null : null)
      ?? assignment.last_status_update_at
      ?? assignment.accepted_at;
    if (!ref) return null;
    const elapsed = (Date.now() - new Date(ref).getTime()) / 60000;
    return elapsed > t.minutes ? t.reason : null;
  })();

  return (
    <Card data-testid="card-job-status-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Live Job Status
          </CardTitle>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            data-testid="button-refresh-job-status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* RC Identity + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" data-testid="text-rc-name">
              {assignment.ridechecker?.full_name ?? "Unknown RC"}
            </p>
            {assignment.ridechecker?.phone && (
              <p className="text-xs text-muted-foreground">{assignment.ridechecker.phone}</p>
            )}
          </div>
          {cfg && (
            <Badge className={`shrink-0 flex items-center gap-1 text-xs border ${cfg.color}`} data-testid="badge-job-status">
              {cfg.icon}
              {cfg.label}
            </Badge>
          )}
        </div>

        {/* Bottleneck Warning */}
        {isBottleneck && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" data-testid="alert-bottleneck">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Bottleneck Detected</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">{isBottleneck}</p>
            </div>
          </div>
        )}

        {/* Escalation Notes */}
        {assignment.status === "escalated" && assignment.escalation_notes && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" data-testid="alert-escalation">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Escalation Note</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">{assignment.escalation_notes}</p>
            </div>
          </div>
        )}

        {/* Decline / Rejection Info */}
        {["declined"].includes(assignment.status) && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs">
            <p className="font-semibold text-red-700 dark:text-red-400 mb-1">Job Declined</p>
            {assignment.rejection_reason && (
              <p className="text-red-600 dark:text-red-500">Reason: {assignment.rejection_reason}</p>
            )}
            {assignment.declined_at && (
              <p className="text-muted-foreground mt-0.5">{formatRelative(assignment.declined_at)}</p>
            )}
          </div>
        )}

        {/* GPS Location */}
        {assignment.last_known_lat != null && assignment.last_known_lng != null && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30" data-testid="section-gps-location">
            <MapPin className="h-4 w-4 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Last Known Location</p>
              <p className="text-xs text-muted-foreground">
                {assignment.last_known_lat.toFixed(4)}, {assignment.last_known_lng.toFixed(4)}
                {assignment.last_location_update_at && (
                  <span className="ml-1">· {formatRelative(assignment.last_location_update_at)}</span>
                )}
              </p>
            </div>
            <a
              href={mapsUrl(assignment.last_known_lat, assignment.last_known_lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline underline-offset-2 shrink-0"
              data-testid="link-view-on-map"
            >
              Map
            </a>
          </div>
        )}

        {/* Milestone Timeline */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Timeline
          </p>
          <div className="space-y-1.5">
            {MILESTONES.map(({ label, key, status }) => {
              const ts = assignment[key as keyof Assignment] as string | null | undefined;
              const reached = !!ts || statusIndex(status) < curIdx;
              const current = assignment.status === status;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 text-xs py-1 ${
                    reached || current ? "text-foreground" : "text-muted-foreground/50"
                  }`}
                  data-testid={`milestone-${status}`}
                >
                  <div
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      current
                        ? "bg-primary ring-2 ring-primary/30"
                        : reached
                        ? "bg-green-500"
                        : "bg-muted-foreground/25"
                    }`}
                  />
                  <span className={current ? "font-semibold" : ""}>{label}</span>
                  {ts && (
                    <span className="ml-auto text-muted-foreground">
                      {formatRelative(ts)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Status Log */}
        {statusLog.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Activity Log
            </p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {statusLog.slice(0, 8).map((entry, i) => (
                <div key={i} className="flex items-start gap-2 text-xs" data-testid={`log-entry-${i}`}>
                  <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium capitalize">
                      {entry.new_status.replace(/_/g, " ")}
                    </span>
                    {entry.old_status && (
                      <span className="text-muted-foreground"> ← {entry.old_status.replace(/_/g, " ")}</span>
                    )}
                    {entry.notes && (
                      <p className="text-muted-foreground truncate">{entry.notes}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0">{formatRelative(entry.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Update */}
        {assignment.last_status_update_at && (
          <p className="text-xs text-muted-foreground text-right" data-testid="text-last-update">
            Last update: {formatRelative(assignment.last_status_update_at)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
