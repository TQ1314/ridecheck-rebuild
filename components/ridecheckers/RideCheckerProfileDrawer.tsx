"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MapPin,
  Star,
  Briefcase,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Truck,
  ExternalLink,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Bell,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { pickTemplate } from "@/lib/ridecheckers/reminderTemplates";
import { cn } from "@/lib/utils";
import { getRideCheckerEligibility, type EligibilityProfile } from "@/lib/ridecheckers/eligibility";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RcProfile extends EligibilityProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  service_area?: string | null;
  workflow_stage?: string | null;
  is_active?: boolean | null;
  ridechecker_jobs_completed?: number | null;
  ridechecker_rating?: string | null;
  ridechecker_quality_score?: number | null;
  experience?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  suspended_at?: string | null;
}

interface Props {
  rcId: string | null;
  initialProfile?: Partial<RcProfile>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditDetails?: (rcId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const STAGE_COLORS: Record<string, string> = {
  active:              "bg-emerald-100 text-emerald-800 border-emerald-200",
  approved:            "bg-green-100 text-green-800 border-green-200",
  ready_for_approval:  "bg-lime-100 text-lime-800 border-lime-200",
  background_clear:    "bg-teal-100 text-teal-800 border-teal-200",
  background_pending:  "bg-orange-100 text-orange-800 border-orange-200",
  rejected:            "bg-red-100 text-red-800 border-red-200",
  suspended:           "bg-rose-100 text-rose-800 border-rose-200",
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `(***) ***-${last4 || "????"}`;
}

function StatusIcon({ status }: { status: "complete" | "pending" | "missing" | "failed" }) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
  if (status === "pending")  return <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />;
  if (status === "failed")   return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
  return <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0 inline-block" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RideCheckerProfileDrawer({
  rcId,
  initialProfile,
  open,
  onOpenChange,
  onEditDetails,
}: Props) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<RcProfile | null>(
    initialProfile && initialProfile.id ? (initialProfile as RcProfile) : null
  );
  const [loading, setLoading] = useState(false);
  const [contactRevealed, setContactRevealed] = useState(false);
  const [remindLoading, setRemindLoading] = useState(false);

  async function handleSendReminder() {
    if (!profile) return;
    setRemindLoading(true);
    try {
      const res = await fetch("/api/ops/ridecheckers/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ridechecker_id: profile.id }),
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
          title: `Reminder sent to ${profile.full_name}`,
          description: `"${data.template_label}" via ${[data.email_sent && "email", data.sms_sent && "SMS"].filter(Boolean).join(" + ")}`,
        });
      }
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setRemindLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !rcId) return;
    setContactRevealed(false);

    // If we already have a full profile for this RC, use it
    if (initialProfile?.id === rcId && initialProfile.full_name) {
      setProfile(initialProfile as RcProfile);
      return;
    }

    setLoading(true);
    fetch(`/api/admin/ridecheckers/${rcId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.candidate) setProfile(data.candidate as RcProfile);
      })
      .catch(() => {/* silent */})
      .finally(() => setLoading(false));
  }, [open, rcId]);

  if (!open) return null;

  const eligibility = profile ? getRideCheckerEligibility(profile) : null;
  const stage = profile?.workflow_stage ?? null;
  const isTerminal = stage === "rejected" || stage === "suspended";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-base">RideChecker Profile</SheetTitle>
        </SheetHeader>

        {/* ── Loading ── */}
        {loading && !profile && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Profile content ── */}
        {profile && eligibility && (
          <div className="space-y-5 pt-4">

            {/* ── Header: name + status ── */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar placeholder */}
                <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-primary">
                    {(profile.full_name || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-snug">{profile.full_name}</p>
                  {profile.service_area && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      {profile.service_area}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                {stage && (
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                    STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-700 border-gray-200",
                  )}>
                    {STAGE_LABELS[stage] ?? stage}
                  </span>
                )}
                {eligibility.dispatchEligible ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="h-3 w-3" />Dispatch: Eligible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                    <ShieldOff className="h-3 w-3" />Dispatch: Blocked
                  </span>
                )}
              </div>
            </div>

            {/* ── Blocked reasons callout ── */}
            {!eligibility.dispatchEligible && eligibility.blockedReasons.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 space-y-1">
                <p className="text-xs font-semibold text-red-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Not dispatch eligible
                </p>
                <ul className="space-y-0.5">
                  {eligibility.blockedReasons.map((r) => (
                    <li key={r} className="text-xs text-red-700">· {r}</li>
                  ))}
                </ul>
                <p className="text-xs text-red-600 font-medium pt-0.5">
                  Next: {eligibility.nextAction}
                </p>
              </div>
            )}

            {/* ── Stats row ── */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-muted/50 border px-2.5 py-2 text-center">
                <p className="text-xs text-muted-foreground">Jobs</p>
                <p className="text-sm font-bold">{profile.ridechecker_jobs_completed ?? 0}</p>
              </div>
              <div className="rounded-md bg-muted/50 border px-2.5 py-2 text-center">
                <p className="text-xs text-muted-foreground">Rating</p>
                <p className="text-sm font-bold flex items-center justify-center gap-0.5">
                  <Star className="h-3 w-3 text-amber-400" />
                  {parseFloat(profile.ridechecker_rating ?? "0") > 0
                    ? parseFloat(profile.ridechecker_rating!).toFixed(1)
                    : "—"}
                </p>
              </div>
              <div className="rounded-md bg-muted/50 border px-2.5 py-2 text-center">
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-sm font-bold">{eligibility.progressPercent}%</p>
              </div>
            </div>

            {/* ── Contact info ── */}
            <div className="rounded-md border bg-muted/30 divide-y">
              {/* Email */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs flex-1 min-w-0 truncate font-mono">
                  {contactRevealed ? profile.email : maskEmail(profile.email)}
                </span>
              </div>
              {/* Phone */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs flex-1 min-w-0 truncate font-mono">
                  {profile.phone
                    ? contactRevealed ? profile.phone : maskPhone(profile.phone)
                    : <span className="text-muted-foreground not-italic">No phone on file</span>
                  }
                </span>
              </div>
              {/* Reveal toggle */}
              <button
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setContactRevealed((v) => !v)}
                data-testid="button-toggle-contact-reveal"
              >
                {contactRevealed ? (
                  <><EyeOff className="h-3 w-3" />Hide contact info</>
                ) : (
                  <><Eye className="h-3 w-3" />Reveal contact info</>
                )}
              </button>
            </div>

            {/* ── Eligibility checklist ── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Eligibility Checklist
              </p>
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-3">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isTerminal           ? "bg-red-400"     :
                    eligibility.progressPercent === 100 ? "bg-emerald-500" :
                    eligibility.progressPercent >= 60   ? "bg-amber-400"   : "bg-blue-400",
                  )}
                  style={{ width: `${eligibility.progressPercent}%` }}
                />
              </div>
              <div className="space-y-2">
                {eligibility.checklist.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      "flex items-start gap-2.5 rounded-md px-2.5 py-2 border",
                      item.status === "complete" ? "bg-emerald-50/50 border-emerald-100" :
                      item.status === "pending"  ? "bg-amber-50/50 border-amber-100"   :
                      item.status === "failed"   ? "bg-red-50/50 border-red-100"       :
                      item.blocksDispatch        ? "bg-red-50/30 border-red-100/70"    :
                      "bg-muted/30 border-muted",
                    )}
                  >
                    <StatusIcon status={item.status} />
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-xs font-medium leading-snug",
                        item.status === "complete" ? "text-emerald-800" :
                        item.status === "pending"  ? "text-amber-800"   :
                        item.status === "failed"   ? "text-red-800"     :
                        item.blocksDispatch        ? "text-red-700"     : "text-muted-foreground",
                      )}>
                        {item.label}
                        {item.blocksDispatch && item.status !== "complete" && (
                          <span className="ml-1.5 text-[10px] font-semibold px-1 py-0 rounded bg-red-100 text-red-600 border border-red-200">
                            blocks dispatch
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Experience ── */}
            {profile.experience && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Experience
                </p>
                <p className="text-xs bg-muted/50 rounded-md px-3 py-2 leading-relaxed border">
                  {profile.experience}
                </p>
              </div>
            )}

            {/* ── Rejection/Suspension note ── */}
            {isTerminal && profile.rejection_reason && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-red-800 mb-1">
                  {stage === "suspended" ? "Suspension reason" : "Rejection reason"}
                </p>
                <p className="text-xs text-red-700">{profile.rejection_reason}</p>
              </div>
            )}

            {/* ── Send Reminder ── */}
            {!isTerminal && !eligibility.dispatchEligible && (() => {
              const picked = pickTemplate(profile);
              if (!picked) return null;
              return (
                <button
                  onClick={handleSendReminder}
                  disabled={remindLoading}
                  className="w-full text-left rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3 py-2 text-xs text-amber-800 font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                  data-testid="button-send-reminder-drawer"
                >
                  {remindLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
                    : <Bell className="h-3.5 w-3.5 flex-shrink-0" />
                  }
                  <span className="truncate">
                    {remindLoading ? "Sending…" : `Remind: ${picked.template.label}`}
                  </span>
                </button>
              );
            })()}

            {/* ── Actions footer ── */}
            <div className="flex gap-2 pt-2 border-t">
              {onEditDetails && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs gap-1.5"
                  onClick={() => onEditDetails(profile.id)}
                  data-testid="button-open-edit-details"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Manage
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1.5 text-muted-foreground"
                onClick={() => window.open(`/admin/ridecheckers`, "_blank")}
                data-testid="button-open-ridecheckers-page"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Pipeline
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
