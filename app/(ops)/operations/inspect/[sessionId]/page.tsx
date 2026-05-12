"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, CheckCircle2, AlertCircle, XCircle, AlertTriangle,
  Camera, Loader2, Car, ClipboardList, ShieldAlert,
} from "lucide-react";
import { INSPECTION_STEPS, SECTIONS } from "@/lib/inspection/steps";

// ─── Types ─────────────────────────────────────────────────────────────────

interface StepData {
  id: string; step_key: string; section: string; answer?: string;
  severity?: string; note?: string; wide_photo_url?: string;
  close_photo_url?: string; completed: boolean; completed_at?: string;
}

interface ReviewData {
  session: { id: string; status: string; started_at: string; submitted_at?: string };
  assignment: { id: string; status: string } | null;
  order: { id: string; order_id: string; vehicle_year?: string; vehicle_make?: string; vehicle_model?: string; inspection_address?: string } | null;
  ridechecker: { id: string; full_name: string; email: string; phone?: string } | null;
  steps_by_section: Record<string, { stepDef: { key: string; title: string; requiresPhotos: boolean; allowNotAccessible: boolean }; stepData: StepData | null }[]>;
  all_steps: StepData[];
  issues: { id: string; issue_type: string; note: string; hold_triggered: boolean; created_at: string }[];
  summary: { total_steps: number; completed_count: number; concerns_count: number; not_accessible_count: number; critical_count: number; photo_count: number };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function AnswerBadge({ answer, severity }: { answer?: string; severity?: string }) {
  if (!answer) return <Badge variant="outline" className="text-xs">Pending</Badge>;
  if (answer === "pass") return (
    <Badge className="text-xs bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300">
      <CheckCircle2 className="h-3 w-3 mr-1" /> Looks OK
    </Badge>
  );
  if (answer === "concern") {
    const sevColors: Record<string, string> = {
      critical: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300",
      high:     "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300",
      medium:   "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300",
      low:      "bg-yellow-100 text-yellow-800 border-yellow-300",
    };
    return (
      <Badge className={`text-xs ${sevColors[severity ?? ""] ?? "bg-amber-100 text-amber-800 border-amber-300"}`}>
        <AlertCircle className="h-3 w-3 mr-1" />
        Concern{severity ? ` — ${severity}` : ""}
      </Badge>
    );
  }
  if (answer === "not_accessible") return (
    <Badge className="text-xs bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300">
      <XCircle className="h-3 w-3 mr-1" /> Not Accessible
    </Badge>
  );
  return <Badge variant="outline" className="text-xs capitalize">{answer}</Badge>;
}

function PhotoPair({ wide, close, stepKey }: { wide?: string; close?: string; stepKey: string }) {
  if (!wide && !close) return (
    <p className="text-xs text-muted-foreground italic">No photos uploaded</p>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {wide && (
        <a href={wide} target="_blank" rel="noopener noreferrer">
          <img src={wide} alt="Wide" className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity" data-testid={`img-wide-${stepKey}`} />
          <p className="text-xs text-muted-foreground mt-0.5 text-center">Wide</p>
        </a>
      )}
      {close && (
        <a href={close} target="_blank" rel="noopener noreferrer">
          <img src={close} alt="Close" className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity" data-testid={`img-close-${stepKey}`} />
          <p className="text-xs text-muted-foreground mt-0.5 text-center">Close-up</p>
        </a>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function OpsInspectReviewPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(SECTIONS));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/ops/inspect/${sessionId}`);
        if (res.ok) setData(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, [sessionId]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  };

  if (loading) return (
    <AppShell>
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  if (!data) return (
    <AppShell>
      <div className="flex h-64 items-center justify-center flex-col gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">Inspection session not found.</p>
      </div>
    </AppShell>
  );

  const { session, order, ridechecker, issues, summary, steps_by_section } = data;
  const vehicleLabel = [order?.vehicle_year, order?.vehicle_make, order?.vehicle_model].filter(Boolean).join(" ");

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-5 max-w-screen-lg mx-auto">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {order && (
            <Link href={`/operations/orders/${order.id}`}>
              <Button size="icon" variant="ghost" data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" data-testid="text-review-title">Inspection Review</h1>
            <p className="text-sm text-muted-foreground">
              {vehicleLabel || "Vehicle"} · {session.status === "submitted" ? "Submitted" : "In Progress"}
            </p>
          </div>
          <Badge className={`${session.status === "submitted"
            ? "bg-green-100 text-green-800 border-green-300"
            : "bg-blue-100 text-blue-800 border-blue-200"}`}
            data-testid="badge-session-status"
          >
            {session.status === "submitted" ? "Submitted" : "In Progress"}
          </Badge>
        </div>

        {/* ── Info strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-0">
            <CardContent className="flex items-center gap-3 p-4">
              <Car className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Vehicle</p>
                <p className="font-semibold text-sm" data-testid="text-vehicle">{vehicleLabel || "—"}</p>
                {order?.inspection_address && <p className="text-xs text-muted-foreground">{order.inspection_address}</p>}
              </div>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardContent className="flex items-center gap-3 p-4">
              <ClipboardList className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">RideChecker</p>
                <p className="font-semibold text-sm" data-testid="text-ridechecker">{ridechecker?.full_name ?? "—"}</p>
                {ridechecker?.phone && <p className="text-xs text-muted-foreground">{ridechecker.phone}</p>}
              </div>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardContent className="flex items-center gap-3 p-4">
              <Camera className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="font-semibold text-sm">
                  {session.submitted_at
                    ? new Date(session.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Summary cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[
            { label: "Total Steps",  value: summary.total_steps,         color: "text-foreground" },
            { label: "Completed",    value: summary.completed_count,     color: "text-green-600" },
            { label: "Concerns",     value: summary.concerns_count,      color: summary.concerns_count > 0 ? "text-amber-600" : "text-muted-foreground" },
            { label: "Critical",     value: summary.critical_count,      color: summary.critical_count > 0 ? "text-red-600" : "text-muted-foreground" },
            { label: "Not Accessible", value: summary.not_accessible_count, color: "text-slate-600" },
            { label: "Photos",       value: summary.photo_count,         color: "text-blue-600" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="text-center py-3">
              <p className={`text-xl font-bold ${color}`} data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </Card>
          ))}
        </div>

        {/* ── Issues ───────────────────────────────────────────────────── */}
        {issues.length > 0 && (
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
                <ShieldAlert className="h-4 w-4" /> Issues Reported ({issues.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {issues.map((issue) => (
                <div key={issue.id} className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3 space-y-1" data-testid={`issue-${issue.id}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    <span className="text-sm font-semibold text-red-700 dark:text-red-400 capitalize">
                      {issue.issue_type.replace(/_/g, " ")}
                    </span>
                    {issue.hold_triggered && <Badge className="ml-auto text-xs bg-red-600 text-white border-red-600">Hold</Badge>}
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-500">{issue.note}</p>
                  <p className="text-xs text-muted-foreground">{new Date(issue.created_at).toLocaleString()}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Steps by section ──────────────────────────────────────────── */}
        {SECTIONS.map((section) => {
          const sectionSteps = steps_by_section[section] ?? [];
          if (sectionSteps.length === 0) return null;
          const expanded = expandedSections.has(section);
          const sectionConcerns = sectionSteps.filter((s) => s.stepData?.answer === "concern").length;
          return (
            <Card key={section} className={sectionConcerns > 0 ? "border-amber-200 dark:border-amber-800" : ""}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
                onClick={() => toggleSection(section)}
                data-testid={`button-toggle-section-${section}`}
              >
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{section}</CardTitle>
                  {sectionConcerns > 0 && (
                    <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                      {sectionConcerns} concern{sectionConcerns !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {sectionSteps.filter((s) => s.stepData?.completed).length}/{sectionSteps.length} done
                  {" · "}{expanded ? "▲" : "▼"}
                </span>
              </button>

              {expanded && (
                <div className="divide-y border-t">
                  {sectionSteps.map(({ stepDef, stepData: sd }) => {
                    const isConcern = sd?.answer === "concern";
                    const isNA = sd?.answer === "not_accessible";
                    return (
                      <div
                        key={stepDef.key}
                        className={`p-4 space-y-3 ${isConcern ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}
                        data-testid={`step-row-${stepDef.key}`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            {sd?.completed
                              ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                              : <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <p className="font-medium text-sm">{stepDef.title}</p>
                          </div>
                          <AnswerBadge answer={sd?.answer} severity={sd?.severity} />
                        </div>

                        {sd?.note && (
                          <div className={`rounded-lg px-3 py-2 text-sm ${isConcern ? "bg-amber-100/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300" : isNA ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" : "bg-muted/40 text-foreground"}`}>
                            {sd.note}
                          </div>
                        )}

                        {stepDef.requiresPhotos && (sd?.wide_photo_url || sd?.close_photo_url) && (
                          <PhotoPair wide={sd?.wide_photo_url} close={sd?.close_photo_url} stepKey={stepDef.key} />
                        )}

                        {stepDef.requiresPhotos && !sd?.wide_photo_url && !sd?.close_photo_url && sd?.answer !== "not_accessible" && (
                          <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                            <Camera className="h-3 w-3" /> No photos uploaded
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
