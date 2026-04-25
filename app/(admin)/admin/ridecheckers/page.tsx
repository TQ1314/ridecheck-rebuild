"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, Clock, Users, MapPin, ShieldOff,
  AlertTriangle, UserCheck, Activity, Ban, ChevronRight,
  FileText, Star, Shield, BookOpen, History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────

const APPROVAL_ROLES = ["owner", "operations_lead"];

const STAGE_LABELS: Record<string, string> = {
  applied:             "Applied",
  under_review:        "Under Review",
  docs_requested:      "Docs Requested",
  docs_received:       "Docs Received",
  background_pending:  "Background Pending",
  background_clear:    "Background Clear",
  reference_pending:   "References Pending",
  assessment_pending:  "Assessment Pending",
  ready_for_approval:  "Ready for Approval",
  approved:            "Approved",
  active:              "Active",
  rejected:            "Rejected",
  suspended:           "Suspended",
};

const STAGE_COLORS: Record<string, string> = {
  applied:             "bg-gray-100 text-gray-700 border-gray-200",
  under_review:        "bg-blue-100 text-blue-700 border-blue-200",
  docs_requested:      "bg-amber-100 text-amber-700 border-amber-200",
  docs_received:       "bg-yellow-100 text-yellow-700 border-yellow-200",
  background_pending:  "bg-orange-100 text-orange-700 border-orange-200",
  background_clear:    "bg-teal-100 text-teal-700 border-teal-200",
  reference_pending:   "bg-purple-100 text-purple-700 border-purple-200",
  assessment_pending:  "bg-indigo-100 text-indigo-700 border-indigo-200",
  ready_for_approval:  "bg-lime-100 text-lime-700 border-lime-200",
  approved:            "bg-green-100 text-green-700 border-green-200",
  active:              "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected:            "bg-red-100 text-red-700 border-red-200",
  suspended:           "bg-rose-100 text-rose-700 border-rose-200",
};

// Stages available in the stage-advance dropdown (terminal stages excluded)
const ADVANCEABLE_STAGES = [
  "applied", "under_review", "docs_requested", "docs_received",
  "background_pending", "background_clear", "reference_pending",
  "assessment_pending", "ready_for_approval", "active",
];

type StageGroup = "all" | "pipeline" | "ready" | "active" | "closed";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RideChecker {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  service_area: string | null;
  experience: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  rating: number | null;
  referral_code: string | null;
  workflow_stage: string | null;
  documents_complete: boolean;
  background_check_status: string | null;
  references_status: string | null;
  assessment_score: number | null;
  reviewer_notes: string | null;
  invite_sent_at: string | null;
  invite_accepted_at: string | null;
  suspended_at: string | null;
  ridechecker_rating: string | null;
  ridechecker_jobs_completed: number | null;
  ridechecker_quality_score: number | null;
  training_sip4_completed: boolean | null;
}

interface StageHistoryEntry {
  id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by_email: string;
  changed_by_role: string;
  notes: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  pipeline: number;
  ready: number;
  active: number;
  closed: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
      STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-700 border-gray-200",
    )}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

function StatusDot({ value, label }: { value: string | null | boolean; label: string }) {
  const isOk = value === true || value === "clear" || value === "verified";
  const isPending = value === "pending";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={cn(
        "h-2 w-2 rounded-full flex-shrink-0",
        isOk ? "bg-green-500" : isPending ? "bg-amber-400" : "bg-gray-300",
      )} />
      <span className={isOk ? "text-green-700" : isPending ? "text-amber-700" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

function canBeApproved(rc: RideChecker): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (rc.workflow_stage !== "ready_for_approval") {
    reasons.push("Stage must be Ready for Approval");
  }
  if (!rc.documents_complete) reasons.push("Documents not marked complete");
  if (rc.assessment_score == null) reasons.push("Assessment score missing");
  return { ok: reasons.length === 0, reasons };
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function RideCheckersAdminPage() {
  const { toast } = useToast();
  const supabase = createClient();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [ridecheckers, setRidecheckers] = useState<RideChecker[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pipeline: 0, ready: 0, active: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [stageGroup, setStageGroup] = useState<StageGroup>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRc, setDetailRc] = useState<RideChecker | null>(null);
  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Stage update dialog
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [stageTarget, setStageTarget] = useState<RideChecker | null>(null);
  const [newStage, setNewStage] = useState("");
  const [stageNotes, setStageNotes] = useState("");

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<RideChecker | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Suspend dialog
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<RideChecker | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const canApprove = userRole !== null && APPROVAL_ROLES.includes(userRole);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      setUserRole(profile?.role ?? null);
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ridecheckers?stage_group=${stageGroup}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRidecheckers(data.ridecheckers || []);
      setStats(data.stats || { total: 0, pipeline: 0, ready: 0, active: 0, closed: 0 });
    } catch {
      toast({ title: "Failed to load RideCheckers", variant: "destructive" });
    }
    setLoading(false);
  }, [stageGroup]);

  useEffect(() => { loadData(); }, [loadData]);

  async function openDetail(rc: RideChecker) {
    setDetailRc(rc);
    setDetailOpen(true);
    setDetailLoading(true);
    setStageHistory([]);
    try {
      const res = await fetch(`/api/admin/ridecheckers/${rc.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetailRc(data.candidate);
      setStageHistory(data.stageHistory || []);
    } catch {
      toast({ title: "Could not load candidate details", variant: "destructive" });
    }
    setDetailLoading(false);
  }

  async function patchRc(payload: Record<string, any>, successMsg: string) {
    const userId = payload.userId;
    setActionLoading(userId);
    try {
      const res = await fetch("/api/admin/ridecheckers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Request failed");
      }
      toast({ title: successMsg });
      await loadData();
      // Refresh detail if open
      if (detailOpen && detailRc?.id === userId) {
        openDetail({ ...detailRc!, ...payload } as any);
      }
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
    setActionLoading(null);
  }

  // Approve
  const handleApprove = async (rc: RideChecker) => {
    await patchRc({ userId: rc.id, action: "approve" }, `${rc.full_name} approved`);
  };

  // Stage update
  const openStageDialog = (rc: RideChecker) => {
    setStageTarget(rc);
    setNewStage(rc.workflow_stage || "applied");
    setStageNotes("");
    setStageDialogOpen(true);
  };
  const handleStageUpdate = async () => {
    if (!stageTarget) return;
    await patchRc(
      { userId: stageTarget.id, action: "update_stage", toStage: newStage, notes: stageNotes },
      "Stage updated"
    );
    setStageDialogOpen(false);
  };

  // Reject
  const openRejectDialog = (rc: RideChecker) => {
    setRejectTarget(rc);
    setRejectReason("");
    setRejectDialogOpen(true);
  };
  const handleReject = async () => {
    if (!rejectTarget) return;
    await patchRc(
      { userId: rejectTarget.id, action: "reject", reason: rejectReason },
      `${rejectTarget.full_name} rejected`
    );
    setRejectDialogOpen(false);
  };

  // Suspend
  const openSuspendDialog = (rc: RideChecker) => {
    setSuspendTarget(rc);
    setSuspendReason("");
    setSuspendDialogOpen(true);
  };
  const handleSuspend = async () => {
    if (!suspendTarget) return;
    await patchRc(
      { userId: suspendTarget.id, action: "suspend", reason: suspendReason },
      `${suspendTarget.full_name} suspended`
    );
    setSuspendDialogOpen(false);
  };

  const FILTER_TABS: { key: StageGroup; label: string; count?: number }[] = [
    { key: "all",      label: "All",              count: stats.total },
    { key: "pipeline", label: "In Pipeline",       count: stats.pipeline },
    { key: "ready",    label: "Ready for Approval",count: stats.ready },
    { key: "active",   label: "Active",            count: stats.active },
    { key: "closed",   label: "Rejected / Suspended", count: stats.closed },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          RideChecker Hiring Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage applicants through the full onboarding workflow
        </p>
        {!canApprove && userRole === "operations" && (
          <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 w-fit">
            <ShieldOff className="h-3.5 w-3.5 shrink-0" />
            View-only — approval authority requires Operations Lead or above.
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total",             value: stats.total,    icon: <Users className="h-4 w-4 text-muted-foreground" /> },
          { label: "In Pipeline",       value: stats.pipeline, icon: <Clock className="h-4 w-4 text-blue-500" /> },
          { label: "Ready for Approval",value: stats.ready,    icon: <UserCheck className="h-4 w-4 text-lime-600" /> },
          { label: "Active",            value: stats.active,   icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
          { label: "Rejected / Susp.",  value: stats.closed,   icon: <Ban className="h-4 w-4 text-rose-500" /> },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{s.label}</CardTitle>
              {s.icon}
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(({ key, label, count }) => (
          <Button
            key={key}
            variant={stageGroup === key ? "default" : "outline"}
            size="sm"
            onClick={() => setStageGroup(key)}
            data-testid={`button-filter-${key}`}
          >
            {label}
            {count !== undefined && (
              <span className={cn(
                "ml-1.5 text-xs rounded-full px-1.5 py-0.5 font-medium",
                stageGroup === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
              )}>
                {count}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : ridecheckers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No RideCheckers Found</h3>
            <p className="text-sm text-muted-foreground">No candidates match this filter.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Training</TableHead>
                  <TableHead>Applied</TableHead>
                  {canApprove && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ridecheckers.map((rc) => {
                  const approval = canBeApproved(rc);
                  const isActive = rc.workflow_stage === "active" || rc.workflow_stage === "approved";
                  return (
                    <TableRow
                      key={rc.id}
                      data-testid={`row-ridechecker-${rc.id}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(rc)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{rc.full_name}</p>
                          <p className="text-xs text-muted-foreground">{rc.email}</p>
                          {rc.phone && (
                            <p className="text-xs text-muted-foreground">{rc.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {rc.service_area ? (
                          <span className="flex items-center gap-1 text-xs">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {rc.service_area}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={rc.workflow_stage} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <StatusDot value={rc.documents_complete} label="Docs" />
                          <StatusDot value={rc.background_check_status} label="Background" />
                          <StatusDot value={rc.references_status} label="References" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {rc.assessment_score != null ? (
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-500" />
                            <span className="text-sm font-medium">{rc.assessment_score}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rc.training_sip4_completed ? (
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                            "bg-emerald-100 text-emerald-700 border-emerald-200",
                          )}>
                            Passed
                          </span>
                        ) : (
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                            "bg-gray-100 text-gray-500 border-gray-200",
                          )}>
                            Not Started
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(rc.created_at).toLocaleDateString()}
                      </TableCell>

                      {canApprove && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1.5 min-w-[120px]">
                            {/* Approve — gated by prerequisites */}
                            {!isActive && rc.workflow_stage !== "rejected" && rc.workflow_stage !== "suspended" && (
                              <div className="relative group">
                                <Button
                                  size="sm"
                                  className="w-full text-xs"
                                  disabled={!approval.ok || actionLoading === rc.id}
                                  onClick={() => handleApprove(rc)}
                                  data-testid={`button-approve-${rc.id}`}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                {!approval.ok && (
                                  <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover:block bg-popover border rounded-md shadow-md p-2 text-xs w-52">
                                    <p className="font-medium mb-1 text-destructive">Prerequisites not met:</p>
                                    <ul className="space-y-0.5 list-disc list-inside text-muted-foreground">
                                      {approval.reasons.map((r) => <li key={r}>{r}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Advance Stage */}
                            {rc.workflow_stage !== "rejected" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs"
                                disabled={actionLoading === rc.id}
                                onClick={() => openStageDialog(rc)}
                                data-testid={`button-stage-${rc.id}`}
                              >
                                <ChevronRight className="h-3 w-3 mr-1" />
                                {rc.workflow_stage === "active" || rc.workflow_stage === "approved" ? "Manage" : "Advance"}
                              </Button>
                            )}

                            {/* Reject */}
                            {!isActive && rc.workflow_stage !== "rejected" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full text-xs text-destructive hover:text-destructive"
                                disabled={actionLoading === rc.id}
                                onClick={() => openRejectDialog(rc)}
                                data-testid={`button-reject-${rc.id}`}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            )}

                            {/* Suspend */}
                            {isActive && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full text-xs text-orange-600 hover:text-orange-700"
                                disabled={actionLoading === rc.id}
                                onClick={() => openSuspendDialog(rc)}
                                data-testid={`button-suspend-${rc.id}`}
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Suspend
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ── Candidate Detail Dialog ── */}
      <CandidateDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        rc={detailRc}
        stageHistory={stageHistory}
        loading={detailLoading}
        canApprove={canApprove}
        actionLoading={actionLoading}
        onApprove={handleApprove}
        onReject={openRejectDialog}
        onSuspend={openSuspendDialog}
        onStageUpdate={openStageDialog}
        onFieldsSaved={async (userId, updates) => {
          await patchRc({ userId, action: "update_fields", ...updates }, "Saved");
        }}
      />

      {/* ── Stage Update Dialog ── */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stage — {stageTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">New Stage</Label>
              <Select value={newStage} onValueChange={setNewStage}>
                <SelectTrigger data-testid="select-new-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADVANCEABLE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Notes (optional — visible to candidate)</Label>
              <Textarea
                value={stageNotes}
                onChange={(e) => setStageNotes(e.target.value)}
                placeholder="e.g. Please upload your driver's license and vehicle inspection training certificate"
                rows={3}
                className="resize-none"
                data-testid="input-stage-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleStageUpdate}
              disabled={actionLoading === stageTarget?.id || newStage === stageTarget?.workflow_stage}
              data-testid="button-confirm-stage"
            >
              Update Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application — {rejectTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will permanently reject the application and notify the candidate by email.
            </p>
            <div>
              <Label className="mb-2 block">Reason (optional — sent to candidate)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Insufficient relevant experience at this time"
                rows={3}
                className="resize-none"
                data-testid="input-reject-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading === rejectTarget?.id}
              data-testid="button-confirm-reject"
            >
              {actionLoading === rejectTarget?.id ? "Rejecting..." : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Suspend Dialog ── */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend RideChecker — {suspendTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>This will revoke dashboard access immediately. The record is kept for reinstatement.</p>
            </div>
            <div>
              <Label className="mb-2 block">Reason (internal)</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Multiple quality issues — pending review"
                rows={3}
                className="resize-none"
                data-testid="input-suspend-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={actionLoading === suspendTarget?.id}
              data-testid="button-confirm-suspend"
            >
              {actionLoading === suspendTarget?.id ? "Suspending..." : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Candidate Detail Dialog ────────────────────────────────────────────────

interface DetailDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rc: RideChecker | null;
  stageHistory: StageHistoryEntry[];
  loading: boolean;
  canApprove: boolean;
  actionLoading: string | null;
  onApprove: (rc: RideChecker) => void;
  onReject: (rc: RideChecker) => void;
  onSuspend: (rc: RideChecker) => void;
  onStageUpdate: (rc: RideChecker) => void;
  onFieldsSaved: (userId: string, updates: Record<string, any>) => Promise<void>;
}

function CandidateDetailDialog({
  open, onOpenChange, rc, stageHistory, loading,
  canApprove, actionLoading, onApprove, onReject, onSuspend, onStageUpdate,
  onFieldsSaved,
}: DetailDialogProps) {
  const [savingNotes, setSavingNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState("");
  const [savingFields, setSavingFields] = useState(false);
  const [fields, setFields] = useState<{
    documents_complete: boolean;
    background_check_status: string;
    references_status: string;
    assessment_score: string;
  }>({
    documents_complete: false,
    background_check_status: "not_started",
    references_status: "not_started",
    assessment_score: "",
  });

  useEffect(() => {
    if (rc) {
      setLocalNotes(rc.reviewer_notes || "");
      setFields({
        documents_complete: rc.documents_complete ?? false,
        background_check_status: rc.background_check_status ?? "not_started",
        references_status: rc.references_status ?? "not_started",
        assessment_score: rc.assessment_score != null ? String(rc.assessment_score) : "",
      });
    }
  }, [rc]);

  if (!rc) return null;

  const approval = canBeApproved(rc);
  const isActive = rc.workflow_stage === "active" || rc.workflow_stage === "approved";

  async function saveNotes() {
    setSavingNotes(true);
    await onFieldsSaved(rc!.id, { reviewer_notes: localNotes });
    setSavingNotes(false);
  }

  async function saveChecklist() {
    setSavingFields(true);
    const scoreNum = fields.assessment_score !== "" ? parseFloat(fields.assessment_score) : null;
    await onFieldsSaved(rc!.id, {
      documents_complete:      fields.documents_complete,
      background_check_status: fields.background_check_status,
      references_status:       fields.references_status,
      assessment_score:        isNaN(scoreNum as any) ? null : scoreNum,
    });
    setSavingFields(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg">{rc.full_name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{rc.email}</p>
            </div>
            <StageBadge stage={rc.workflow_stage} />
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="mt-2">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="overview"><BookOpen className="h-3.5 w-3.5 mr-1" />Overview</TabsTrigger>
              <TabsTrigger value="checklist"><Shield className="h-3.5 w-3.5 mr-1" />Checklist</TabsTrigger>
              <TabsTrigger value="notes"><FileText className="h-3.5 w-3.5 mr-1" />Notes</TabsTrigger>
              <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" />History</TabsTrigger>
            </TabsList>

            {/* ── Overview Tab ── */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <InfoRow label="Email" value={rc.email} />
                <InfoRow label="Phone" value={rc.phone || "—"} />
                <InfoRow label="Service Area" value={rc.service_area || "—"} />
                <InfoRow label="Applied" value={new Date(rc.created_at).toLocaleDateString()} />
                {rc.approved_at && (
                  <InfoRow label="Approved" value={new Date(rc.approved_at).toLocaleDateString()} />
                )}
                {rc.invite_sent_at && (
                  <InfoRow label="Invite Sent" value={new Date(rc.invite_sent_at).toLocaleDateString()} />
                )}
                {rc.invite_accepted_at && (
                  <InfoRow label="Invite Accepted" value={new Date(rc.invite_accepted_at).toLocaleDateString()} />
                )}
                {rc.ridechecker_jobs_completed != null && (
                  <InfoRow label="Jobs Completed" value={String(rc.ridechecker_jobs_completed)} />
                )}
                {rc.ridechecker_quality_score != null && (
                  <InfoRow label="Quality Score" value={`${rc.ridechecker_quality_score}%`} />
                )}
              </div>

              {rc.experience && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Experience</p>
                  <p className="text-sm bg-muted rounded-md px-3 py-2 leading-relaxed">{rc.experience}</p>
                </div>
              )}

              {rc.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-800">
                  <p className="font-medium mb-0.5">Rejection / Suspension Reason</p>
                  <p>{rc.rejection_reason}</p>
                </div>
              )}

              {/* Approval readiness summary */}
              {!isActive && rc.workflow_stage !== "rejected" && (
                <div className={cn(
                  "rounded-md border px-3 py-3 text-sm",
                  approval.ok ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                )}>
                  <p className={cn("font-medium mb-1.5", approval.ok ? "text-green-800" : "text-amber-800")}>
                    {approval.ok ? "✓ Ready for approval" : "Approval prerequisites"}
                  </p>
                  {!approval.ok && (
                    <ul className="space-y-0.5 text-amber-700 text-xs list-disc list-inside">
                      {approval.reasons.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {canApprove && (
                <div className="flex gap-2 flex-wrap pt-2 border-t">
                  {!isActive && rc.workflow_stage !== "rejected" && (
                    <Button
                      size="sm"
                      disabled={!approval.ok || actionLoading === rc.id}
                      onClick={() => onApprove(rc)}
                      data-testid={`button-detail-approve-${rc.id}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Approve
                    </Button>
                  )}
                  {rc.workflow_stage !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === rc.id}
                      onClick={() => onStageUpdate(rc)}
                    >
                      <ChevronRight className="h-3.5 w-3.5 mr-1" />
                      Update Stage
                    </Button>
                  )}
                  {!isActive && rc.workflow_stage !== "rejected" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={actionLoading === rc.id}
                      onClick={() => onReject(rc)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                  )}
                  {isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-orange-600 hover:text-orange-700"
                      disabled={actionLoading === rc.id}
                      onClick={() => onSuspend(rc)}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" />
                      Suspend
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Checklist Tab ── */}
            <TabsContent value="checklist" className="space-y-5 mt-4">
              <div className="space-y-4">
                <ChecklistItem
                  label="Documents Complete"
                  description="Applicant has submitted all required documents"
                  checked={fields.documents_complete}
                  onChange={(v) => setFields((f) => ({ ...f, documents_complete: v }))}
                  disabled={!canApprove}
                />

                <div>
                  <Label className="mb-1.5 block text-sm">Background Check Status</Label>
                  <Select
                    value={fields.background_check_status}
                    onValueChange={(v) => setFields((f) => ({ ...f, background_check_status: v }))}
                    disabled={!canApprove}
                  >
                    <SelectTrigger data-testid="select-bg-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="clear">Clear ✓</SelectItem>
                      <SelectItem value="failed">Failed ✗</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm">References Status</Label>
                  <Select
                    value={fields.references_status}
                    onValueChange={(v) => setFields((f) => ({ ...f, references_status: v }))}
                    disabled={!canApprove}
                  >
                    <SelectTrigger data-testid="select-ref-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="verified">Verified ✓</SelectItem>
                      <SelectItem value="failed">Failed ✗</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm">Assessment Score (0–100)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={fields.assessment_score}
                      onChange={(e) => setFields((f) => ({ ...f, assessment_score: e.target.value }))}
                      placeholder="e.g. 87.5"
                      className="w-32"
                      disabled={!canApprove}
                      data-testid="input-assessment-score"
                    />
                    {rc.assessment_score != null && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Activity className="h-3.5 w-3.5" />
                        Currently: {rc.assessment_score}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {canApprove && (
                <Button
                  size="sm"
                  onClick={saveChecklist}
                  disabled={savingFields}
                  data-testid="button-save-checklist"
                >
                  {savingFields ? "Saving…" : "Save Checklist"}
                </Button>
              )}
            </TabsContent>

            {/* ── Notes Tab ── */}
            <TabsContent value="notes" className="space-y-4 mt-4">
              <div>
                <Label className="mb-2 block text-sm">Internal Reviewer Notes</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Internal only — not visible to the candidate.
                </p>
                <Textarea
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  placeholder="Add internal notes about this candidate…"
                  rows={6}
                  className="resize-none"
                  disabled={!canApprove}
                  data-testid="input-reviewer-notes"
                />
              </div>
              {canApprove && (
                <Button size="sm" onClick={saveNotes} disabled={savingNotes} data-testid="button-save-notes">
                  {savingNotes ? "Saving…" : "Save Notes"}
                </Button>
              )}
            </TabsContent>

            {/* ── History Tab ── */}
            <TabsContent value="history" className="mt-4">
              {stageHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No stage history yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {stageHistory.map((entry) => (
                      <div key={entry.id} className="pl-8 relative">
                        <div className="absolute left-0 top-1 h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                          <History className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="bg-muted rounded-md px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.from_stage && (
                              <>
                                <StageBadge stage={entry.from_stage} />
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              </>
                            )}
                            <StageBadge stage={entry.to_stage} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {entry.changed_by_email} ({entry.changed_by_role}) &nbsp;·&nbsp;
                            {new Date(entry.created_at).toLocaleString()}
                          </p>
                          {entry.notes && (
                            <p className="text-xs text-foreground mt-1 italic">"{entry.notes}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function ChecklistItem({
  label, description, checked, onChange, disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-3 cursor-pointer transition-colors",
        checked ? "border-green-300 bg-green-50" : "border-border bg-background",
        disabled && "cursor-not-allowed opacity-70",
      )}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div className={cn(
        "mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0",
        checked ? "border-green-600 bg-green-600" : "border-muted-foreground",
      )}>
        {checked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
