"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, Clock, Users, ShieldOff,
  AlertTriangle, Ban, ChevronRight,
  FileText, Shield, BookOpen, History, Search,
  MapPin, Truck, Star, Activity, Bell,
} from "lucide-react";
import { pickTemplate } from "@/lib/ridecheckers/reminderTemplates";
import { RideCheckerProfileDrawer } from "@/components/ridecheckers/RideCheckerProfileDrawer";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────

const APPROVAL_ROLES = ["owner", "operations_lead"];

const STAGE_ORDER = [
  "applied", "under_review", "docs_requested", "docs_received",
  "background_pending", "background_clear", "reference_pending",
  "assessment_pending", "ready_for_approval", "approved", "active",
  "rejected", "suspended",
];

const STAGE_LABELS: Record<string, string> = {
  applied:             "Applied",
  under_review:        "Under Review",
  docs_requested:      "Docs Requested",
  docs_received:       "Docs Received",
  background_pending:  "Background Pending",
  background_clear:    "Background Clear",
  reference_pending:   "Refs Pending",
  assessment_pending:  "Assessment Pending",
  ready_for_approval:  "Ready for Approval",
  approved:            "Approved",
  active:              "Active",
  rejected:            "Rejected",
  suspended:           "Suspended",
};

const STAGE_TALLY_COLORS: Record<string, string> = {
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

const ADVANCEABLE_STAGES = [
  "applied", "under_review", "docs_requested", "docs_received",
  "background_pending", "background_clear", "reference_pending",
  "assessment_pending", "ready_for_approval", "active",
];

type StageGroup = "all" | "pipeline" | "ready" | "active" | "closed";
type CheckpointStatus = "complete" | "pending" | "blocked" | "not_started";

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
  guide_completed: boolean | null;
  guide_completed_at: string | null;
  verification_status: string | null;
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
  perStage: Record<string, number>;
}

// ─── Pipeline logic ──────────────────────────────────────────────────────────

interface Checkpoint {
  key: string;
  label: string;
  status: CheckpointStatus;
  detail: string;
}

function getPipelineInfo(rc: RideChecker): {
  checkpoints: Checkpoint[];
  percent: number;
  nextAction: string;
  dispatchEligible: boolean;
} {
  const stage = rc.workflow_stage ?? "";
  const isTerminal = stage === "rejected" || stage === "suspended";

  const idStatus: CheckpointStatus =
    rc.verification_status === "active"   ? "complete"    :
    rc.verification_status === "submitted"? "pending"     :
    rc.verification_status === "rejected" ? "blocked"     : "not_started";

  const bgStatus: CheckpointStatus =
    rc.background_check_status === "clear"  ? "complete"  :
    rc.background_check_status === "pending"? "pending"   :
    rc.background_check_status === "failed" ? "blocked"   : "not_started";

  const trainingStatus: CheckpointStatus =
    (rc.guide_completed && rc.training_sip4_completed) ? "complete"  :
    (rc.guide_completed || rc.training_sip4_completed) ? "pending"   : "not_started";

  const testRCStatus: CheckpointStatus =
    (rc.ridechecker_jobs_completed ?? 0) > 0 ? "complete" :
    ["approved", "active"].includes(stage)    ? "pending"  : "not_started";

  const approvalStatus: CheckpointStatus =
    ["approved", "active"].includes(stage) ? "complete"  :
    stage === "ready_for_approval"         ? "pending"   :
    isTerminal                             ? "blocked"   : "not_started";

  const checkpoints: Checkpoint[] = [
    {
      key: "application",
      label: "Application",
      status: "complete",
      detail: `Submitted ${new Date(rc.created_at).toLocaleDateString()}`,
    },
    {
      key: "id_verification",
      label: "ID Verification",
      status: idStatus,
      detail: rc.verification_status === "active"    ? "Verified"
            : rc.verification_status === "submitted" ? "Awaiting review"
            : rc.verification_status === "rejected"  ? "Rejected"
            : "Not submitted",
    },
    {
      key: "background",
      label: "Background Check",
      status: bgStatus,
      detail: rc.background_check_status === "clear"   ? "Clear"
            : rc.background_check_status === "pending" ? "In progress"
            : rc.background_check_status === "failed"  ? "Failed"
            : "Not started",
    },
    {
      key: "training",
      label: "Training",
      status: trainingStatus,
      detail: (rc.guide_completed && rc.training_sip4_completed) ? "Guide + SIP-4 complete"
            : rc.guide_completed   ? "Guide ✓ — SIP-4 pending"
            : rc.training_sip4_completed ? "SIP-4 ✓ — Guide pending"
            : "Not started",
    },
    {
      key: "test_rc",
      label: "Test RideCheck",
      status: testRCStatus,
      detail: (rc.ridechecker_jobs_completed ?? 0) > 0
              ? `${rc.ridechecker_jobs_completed} job(s) completed`
              : ["approved", "active"].includes(stage)
              ? "Awaiting first job"
              : "Pending approval",
    },
    {
      key: "approval",
      label: "Final Approval",
      status: approvalStatus,
      detail: ["approved", "active"].includes(stage) ? "Approved & active"
            : stage === "ready_for_approval"         ? "Ready — awaiting ops decision"
            : isTerminal                             ? stage === "rejected" ? "Rejected" : "Suspended"
            : "In pipeline",
    },
  ];

  const completed = checkpoints.filter((c) => c.status === "complete").length;
  const percent = Math.round((completed / checkpoints.length) * 100);

  const dispatchEligible = rc.is_active === true && ["approved", "active"].includes(stage);

  let nextAction = "No action required";
  if (stage === "rejected")            nextAction = "Review rejection or reinstate";
  else if (stage === "suspended")      nextAction = "Review suspension";
  else if (idStatus !== "complete")    nextAction = idStatus === "pending" ? "Review ID verification" : "Request ID verification";
  else if (bgStatus !== "complete")    nextAction = bgStatus === "pending" ? "Confirm background check result" : "Order background check";
  else if (trainingStatus !== "complete") nextAction = "Assign missing training module(s)";
  else if (stage === "ready_for_approval") nextAction = "Approve RideChecker";
  else if (!["approved", "active"].includes(stage)) nextAction = "Advance to Ready for Approval";

  return { checkpoints, percent, nextAction, dispatchEligible };
}

function canBeApproved(rc: RideChecker): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (rc.workflow_stage !== "ready_for_approval") reasons.push("Stage must be Ready for Approval");
  if (!rc.documents_complete)  reasons.push("Documents not marked complete");
  if (rc.assessment_score == null) reasons.push("Assessment score missing");
  return { ok: reasons.length === 0, reasons };
}

// ─── Small UI helpers ────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
      STAGE_TALLY_COLORS[stage] ?? "bg-gray-100 text-gray-700 border-gray-200",
    )}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

function CheckpointDot({ status, label, detail }: { status: CheckpointStatus; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-1.5" title={detail}>
      {status === "complete"   && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />}
      {status === "pending"    && <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />}
      {status === "blocked"    && <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
      {status === "not_started"&& <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5 inline-block" />}
      <div>
        <p className={cn(
          "text-xs font-medium leading-none",
          status === "complete"    ? "text-emerald-700" :
          status === "pending"     ? "text-amber-700"   :
          status === "blocked"     ? "text-red-700"     : "text-muted-foreground",
        )}>{label}</p>
        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

// ─── Progress bar ────────────────────────────────────────────────────────────

function ProgressBar({ percent, stage }: { percent: number; stage: string | null }) {
  const color =
    stage === "rejected" || stage === "suspended" ? "bg-red-400" :
    percent === 100 ? "bg-emerald-500" :
    percent >= 60   ? "bg-amber-400"   : "bg-blue-400";
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${percent}%` }} />
    </div>
  );
}

// ─── Pipeline Card ───────────────────────────────────────────────────────────

interface PipelineCardProps {
  rc: RideChecker;
  canApprove: boolean;
  actionLoading: string | null;
  onDetail: (rc: RideChecker) => void;
  onApprove: (rc: RideChecker) => void;
  onReject: (rc: RideChecker) => void;
  onSuspend: (rc: RideChecker) => void;
  onStageUpdate: (rc: RideChecker) => void;
  onRemind: (rc: RideChecker) => void;
}

function PipelineCard({
  rc, canApprove, actionLoading,
  onDetail, onApprove, onReject, onSuspend, onStageUpdate, onRemind,
}: PipelineCardProps) {
  const { checkpoints, percent, nextAction, dispatchEligible } = getPipelineInfo(rc);
  const stage = rc.workflow_stage ?? "";
  const isActive = ["approved", "active"].includes(stage);
  const isTerminal = stage === "rejected" || stage === "suspended";
  const isBusy = actionLoading === rc.id;

  const nextActionColor =
    stage === "rejected" || stage === "suspended" ? "bg-red-50 text-red-700 border-red-200" :
    stage === "ready_for_approval"                ? "bg-green-50 text-green-700 border-green-200" :
    nextAction === "No action required"           ? "bg-gray-50 text-gray-500 border-gray-200" :
                                                   "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <Card
      data-testid={`card-ridechecker-${rc.id}`}
      className="flex flex-col hover:shadow-md transition-shadow"
    >
      <CardContent className="p-4 flex flex-col gap-3 h-full">

        {/* ── Header row ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button
              onClick={() => onDetail(rc)}
              className="font-semibold text-sm hover:underline text-left leading-tight"
              data-testid={`button-detail-${rc.id}`}
            >
              {rc.full_name}
            </button>
            <p className="text-xs text-muted-foreground truncate">{rc.email}</p>
            {rc.service_area && (
              <p className="text-xs text-muted-foreground flex items-center gap-0.5 mt-0.5">
                <MapPin className="h-3 w-3 flex-shrink-0" />{rc.service_area}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <StageBadge stage={rc.workflow_stage} />
            <span className="text-xs font-semibold text-muted-foreground">{percent}%</span>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <ProgressBar percent={percent} stage={rc.workflow_stage} />

        {/* ── Checkpoints: 2 columns ── */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {checkpoints.map((cp) => (
            <CheckpointDot key={cp.key} status={cp.status} label={cp.label} detail={cp.detail} />
          ))}
        </div>

        {/* ── Dispatch / jobs row ── */}
        <div className="flex items-center gap-4 pt-1 border-t text-xs">
          <div className="flex items-center gap-1">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={dispatchEligible ? "text-emerald-700 font-medium" : "text-muted-foreground"}>
              Dispatch: {dispatchEligible ? "Eligible" : "Not eligible"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Star className="h-3.5 w-3.5" />
            <span>{rc.ridechecker_jobs_completed ?? 0} RideCheck{(rc.ridechecker_jobs_completed ?? 0) !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* ── Next action ── */}
        <div className={cn("rounded border px-2.5 py-1.5 text-xs font-medium", nextActionColor)}>
          {nextAction === "No action required"
            ? "✓ No action required"
            : `⤳ ${nextAction}`}
        </div>

        {/* ── Send Reminder (all ops roles) ── */}
        {!isTerminal && !dispatchEligible && (() => {
          const picked = pickTemplate(rc);
          if (!picked) return null;
          return (
            <button
              onClick={() => onRemind(rc)}
              disabled={isBusy}
              className="w-full text-left rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 text-xs text-amber-800 font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              data-testid={`button-remind-${rc.id}`}
            >
              <Bell className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Remind: {picked.template.label}</span>
            </button>
          );
        })()}

        {/* ── Action buttons (ops_lead / owner only) ── */}
        {canApprove && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t">
            {!isActive && !isTerminal && (
              <Button
                size="sm"
                className="text-xs h-7 px-2"
                disabled={!canBeApproved(rc).ok || isBusy}
                onClick={() => onApprove(rc)}
                data-testid={`button-approve-${rc.id}`}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />Approve
              </Button>
            )}
            {!isTerminal && (
              <Button
                size="sm" variant="outline"
                className="text-xs h-7 px-2"
                disabled={isBusy}
                onClick={() => onStageUpdate(rc)}
                data-testid={`button-stage-${rc.id}`}
              >
                <ChevronRight className="h-3 w-3 mr-1" />Stage
              </Button>
            )}
            {!isActive && stage !== "rejected" && (
              <Button
                size="sm" variant="ghost"
                className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                disabled={isBusy}
                onClick={() => onReject(rc)}
                data-testid={`button-reject-${rc.id}`}
              >
                <XCircle className="h-3 w-3 mr-1" />Reject
              </Button>
            )}
            {isActive && (
              <Button
                size="sm" variant="ghost"
                className="text-xs h-7 px-2 text-orange-600 hover:text-orange-700"
                disabled={isBusy}
                onClick={() => onSuspend(rc)}
                data-testid={`button-suspend-${rc.id}`}
              >
                <Ban className="h-3 w-3 mr-1" />Suspend
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RideCheckersAdminPage() {
  const { toast } = useToast();
  const supabase = createClient();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [ridecheckers, setRidecheckers] = useState<RideChecker[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, pipeline: 0, ready: 0, active: 0, closed: 0, perStage: {},
  });
  const [loading, setLoading] = useState(true);
  const [stageGroup, setStageGroup] = useState<StageGroup>("all");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Profile drawer (quick view — name click)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRcId, setDrawerRcId] = useState<string | null>(null);
  const [drawerProfile, setDrawerProfile] = useState<RideChecker | null>(null);

  // Detail modal (full edit — opened from drawer or card actions)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRc, setDetailRc] = useState<RideChecker | null>(null);
  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Stage update dialog
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [stageTarget, setStageTarget] = useState<RideChecker | null>(null);

  // Reminder
  const [remindLoading, setRemindLoading] = useState<string | null>(null);
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
        .from("profiles").select("role").eq("id", user.id).maybeSingle();
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
      setStats(data.stats || { total: 0, pipeline: 0, ready: 0, active: 0, closed: 0, perStage: {} });
    } catch {
      toast({ title: "Failed to load RideCheckers", variant: "destructive" });
    }
    setLoading(false);
  }, [stageGroup]);

  useEffect(() => { loadData(); }, [loadData]);

  // Name click → profile drawer (quick view)
  function openDrawer(rc: RideChecker) {
    setDrawerProfile(rc);
    setDrawerRcId(rc.id);
    setDrawerOpen(true);
  }

  // "Manage" inside drawer → full detail dialog with editing
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
      if (detailOpen && detailRc?.id === userId) {
        openDetail({ ...detailRc!, ...payload } as any);
      }
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
    setActionLoading(null);
  }

  const handleApprove = (rc: RideChecker) =>
    patchRc({ userId: rc.id, action: "approve" }, `${rc.full_name} approved`);

  const handleSendReminder = async (rc: RideChecker) => {
    setRemindLoading(rc.id);
    try {
      const res = await fetch("/api/ops/ridecheckers/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ridechecker_id: rc.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: data.dedup ? "Already sent recently" : "Could not send reminder",
          description: data.error,
          variant: data.dedup ? "default" : "destructive",
        });
      } else {
        toast({
          title: `Reminder sent to ${rc.full_name}`,
          description: `"${data.template_label}" via ${[data.email_sent && "email", data.sms_sent && "SMS"].filter(Boolean).join(" + ")}`,
        });
      }
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setRemindLoading(null);
    }
  };

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
      "Stage updated",
    );
    setStageDialogOpen(false);
  };

  const openRejectDialog = (rc: RideChecker) => {
    setRejectTarget(rc); setRejectReason(""); setRejectDialogOpen(true);
  };
  const handleReject = async () => {
    if (!rejectTarget) return;
    await patchRc(
      { userId: rejectTarget.id, action: "reject", reason: rejectReason },
      `${rejectTarget.full_name} rejected`,
    );
    setRejectDialogOpen(false);
  };

  const openSuspendDialog = (rc: RideChecker) => {
    setSuspendTarget(rc); setSuspendReason(""); setSuspendDialogOpen(true);
  };
  const handleSuspend = async () => {
    if (!suspendTarget) return;
    await patchRc(
      { userId: suspendTarget.id, action: "suspend", reason: suspendReason },
      `${suspendTarget.full_name} suspended`,
    );
    setSuspendDialogOpen(false);
  };

  // Filtered list
  const filtered = ridecheckers.filter((rc) => {
    if (stageFilter && rc.workflow_stage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        rc.full_name.toLowerCase().includes(q) ||
        rc.email.toLowerCase().includes(q) ||
        (rc.service_area ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const GROUP_TABS: { key: StageGroup; label: string; count: number }[] = [
    { key: "all",      label: "All",               count: stats.total    },
    { key: "pipeline", label: "In Pipeline",        count: stats.pipeline },
    { key: "ready",    label: "Ready for Approval", count: stats.ready    },
    { key: "active",   label: "Active",             count: stats.active   },
    { key: "closed",   label: "Rejected / Susp.",   count: stats.closed   },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          RideChecker Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every applicant and RideChecker — all pipeline stages, nothing hidden.
        </p>
        {!canApprove && userRole === "operations" && (
          <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 w-fit">
            <ShieldOff className="h-3.5 w-3.5 shrink-0" />
            View-only — approval authority requires Operations Lead or above.
          </div>
        )}
      </div>

      {/* ── Per-stage tally strip ── */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-2 min-w-max">
          {STAGE_ORDER.map((stage) => {
            const count = stats.perStage?.[stage] ?? 0;
            if (count === 0) return null;
            const isSelected = stageFilter === stage;
            return (
              <button
                key={stage}
                onClick={() => setStageFilter(isSelected ? null : stage)}
                data-testid={`tally-${stage}`}
                className={cn(
                  "flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                  isSelected
                    ? "ring-2 ring-primary ring-offset-1 " + STAGE_TALLY_COLORS[stage]
                    : STAGE_TALLY_COLORS[stage] + " opacity-80 hover:opacity-100",
                )}
              >
                <span className="text-lg font-bold leading-none">{count}</span>
                <span className="mt-0.5 whitespace-nowrap">{STAGE_LABELS[stage]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Group filter tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {GROUP_TABS.map(({ key, label, count }) => (
          <Button
            key={key}
            variant={stageGroup === key ? "default" : "outline"}
            size="sm"
            onClick={() => { setStageGroup(key); setStageFilter(null); }}
            data-testid={`button-filter-${key}`}
          >
            {label}
            <span className={cn(
              "ml-1.5 text-xs rounded-full px-1.5 py-0.5 font-medium",
              stageGroup === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
            )}>
              {count}
            </span>
          </Button>
        ))}
        {stageFilter && (
          <Button
            size="sm" variant="secondary"
            onClick={() => setStageFilter(null)}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Clear stage filter
          </Button>
        )}
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, email, city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-ridecheckers"
        />
      </div>

      {/* ── Card grid ── */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No RideCheckers Found</h3>
            <p className="text-sm text-muted-foreground">
              {search || stageFilter ? "No matches for your filters." : "No candidates in this group."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((rc) => (
            <PipelineCard
              key={rc.id}
              rc={rc}
              canApprove={canApprove}
              actionLoading={remindLoading === rc.id ? rc.id : actionLoading}
              onDetail={openDrawer}
              onApprove={handleApprove}
              onReject={openRejectDialog}
              onSuspend={openSuspendDialog}
              onStageUpdate={openStageDialog}
              onRemind={handleSendReminder}
            />
          ))}
        </div>
      )}

      {/* ── RC Profile Drawer (quick view — name click) ── */}
      <RideCheckerProfileDrawer
        rcId={drawerRcId}
        initialProfile={drawerProfile ?? undefined}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEditDetails={(id) => {
          setDrawerOpen(false);
          const rc = ridecheckers.find((r) => r.id === id) ?? drawerProfile;
          if (rc) openDetail(rc as RideChecker);
        }}
      />

      {/* ── Candidate Detail Dialog (full edit — from drawer or action buttons) ── */}
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
                <SelectTrigger data-testid="select-new-stage"><SelectValue /></SelectTrigger>
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
                placeholder="e.g. Please upload your driver's license"
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
              {actionLoading === rejectTarget?.id ? "Rejecting…" : "Reject Application"}
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
              {actionLoading === suspendTarget?.id ? "Suspending…" : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Candidate Detail Dialog ─────────────────────────────────────────────────

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
  const [fields, setFields] = useState({
    documents_complete: false,
    background_check_status: "not_started",
    references_status: "not_started",
    assessment_score: "",
  });

  useEffect(() => {
    if (rc) {
      setLocalNotes(rc.reviewer_notes || "");
      setFields({
        documents_complete:      rc.documents_complete ?? false,
        background_check_status: rc.background_check_status ?? "not_started",
        references_status:       rc.references_status ?? "not_started",
        assessment_score:        rc.assessment_score != null ? String(rc.assessment_score) : "",
      });
    }
  }, [rc]);

  if (!rc) return null;

  const approval = canBeApproved(rc);
  const isActive = ["approved", "active"].includes(rc.workflow_stage ?? "");

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

            {/* ── Overview ── */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <InfoRow label="Email"        value={rc.email} />
                <InfoRow label="Phone"        value={rc.phone || "—"} />
                <InfoRow label="Service Area" value={rc.service_area || "—"} />
                <InfoRow label="Applied"      value={new Date(rc.created_at).toLocaleDateString()} />
                {rc.approved_at && (
                  <InfoRow label="Approved" value={new Date(rc.approved_at).toLocaleDateString()} />
                )}
                {rc.invite_sent_at && (
                  <InfoRow label="Invite Sent" value={new Date(rc.invite_sent_at).toLocaleDateString()} />
                )}
                {rc.invite_accepted_at && (
                  <InfoRow label="Invite Accepted" value={new Date(rc.invite_accepted_at).toLocaleDateString()} />
                )}
                <InfoRow label="Jobs Completed" value={String(rc.ridechecker_jobs_completed ?? 0)} />
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

              {!isActive && rc.workflow_stage !== "rejected" && (
                <div className={cn(
                  "rounded-md border px-3 py-3 text-sm",
                  approval.ok ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200",
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
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                    </Button>
                  )}
                  {rc.workflow_stage !== "rejected" && (
                    <Button size="sm" variant="outline" disabled={actionLoading === rc.id} onClick={() => onStageUpdate(rc)}>
                      <ChevronRight className="h-3.5 w-3.5 mr-1" />Update Stage
                    </Button>
                  )}
                  {!isActive && rc.workflow_stage !== "rejected" && (
                    <Button
                      size="sm" variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={actionLoading === rc.id}
                      onClick={() => onReject(rc)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                    </Button>
                  )}
                  {isActive && (
                    <Button
                      size="sm" variant="ghost"
                      className="text-orange-600 hover:text-orange-700"
                      disabled={actionLoading === rc.id}
                      onClick={() => onSuspend(rc)}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" />Suspend
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Checklist ── */}
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
                    <SelectTrigger data-testid="select-bg-status"><SelectValue /></SelectTrigger>
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
                    <SelectTrigger data-testid="select-ref-status"><SelectValue /></SelectTrigger>
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
                      type="number" min={0} max={100} step={0.5}
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
                <Button size="sm" onClick={saveChecklist} disabled={savingFields} data-testid="button-save-checklist">
                  {savingFields ? "Saving…" : "Save Checklist"}
                </Button>
              )}
            </TabsContent>

            {/* ── Notes ── */}
            <TabsContent value="notes" className="space-y-4 mt-4">
              <div>
                <Label className="mb-2 block text-sm">Internal Reviewer Notes</Label>
                <p className="text-xs text-muted-foreground mb-2">Internal only — not visible to the candidate.</p>
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

            {/* ── History ── */}
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
  label: string; description: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
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
