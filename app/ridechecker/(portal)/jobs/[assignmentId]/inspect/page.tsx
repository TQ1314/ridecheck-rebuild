"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MobilePhotoCapture } from "@/components/ridechecker/MobilePhotoCapture";
import {
  INSPECTION_STEPS, isStepComplete, stepPhotoCount,
  getSectionStatus, ISSUE_TYPES, SECTIONS,
  type StepData, type InspectionStep, type SectionStatus,
} from "@/lib/inspection/steps";
import {
  ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, XCircle,
  AlertTriangle, Loader2, ClipboardCheck, ChevronRight,
  Info, ShieldAlert, Camera, MapPin,
} from "lucide-react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Types / constants
// ─────────────────────────────────────────────────────────────────────────────

interface VehicleInfo {
  year?: string; make?: string; model?: string; trim?: string;
  address?: string; location?: string;
}

type Phase = "loading" | "pre_start" | "wizard" | "submitted";

const RC_GREEN = "#22774F";

// ─────────────────────────────────────────────────────────────────────────────
// Section status helpers
// ─────────────────────────────────────────────────────────────────────────────

function statusColor(s: SectionStatus) {
  if (s === "pass")        return { bg: "bg-green-500",  text: "text-white", label: "PASS"        };
  if (s === "concern")     return { bg: "bg-amber-500",  text: "text-white", label: "CONCERN"     };
  if (s === "critical")    return { bg: "bg-red-600",    text: "text-white", label: "CRITICAL"    };
  if (s === "in_progress") return { bg: "bg-blue-500",   text: "text-white", label: "IN PROGRESS" };
  return                          { bg: "bg-muted",      text: "text-muted-foreground", label: "NOT STARTED" };
}

function answerLabel(answer: string | null | undefined) {
  if (answer === "pass")           return { text: "Looks OK",      cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300" };
  if (answer === "concern")        return { text: "Concern",        cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300" };
  if (answer === "not_accessible") return { text: "Not Accessible", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300" };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function InspectWizardPage() {
  const router       = useRouter();
  const params       = useParams();
  const assignmentId = params.assignmentId as string;
  const { toast }    = useToast();
  const supabase     = createClient();

  const [phase, setPhase]             = useState<Phase>("loading");
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [orderId, setOrderId]         = useState<string>("");
  const [vehicle, setVehicle]         = useState<VehicleInfo>({});
  const [stepIndex, setStepIndex]     = useState(0);
  const [stepData, setStepData]       = useState<Map<string, StepData>>(new Map());
  const [showReview, setShowReview]   = useState(false);
  const [showSectionNav, setShowSectionNav] = useState(false);
  const [issueOpen, setIssueOpen]     = useState(false);
  const [issueType, setIssueType]     = useState("");
  const [issueNote, setIssueNote]     = useState("");
  const [issueSaving, setIssueSaving] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [saveState, setSaveState]     = useState<"idle" | "saving" | "saved">("idle");
  const [sellerType, setSellerType]   = useState<string | null>(null);
  const [showTTInterstitial, setShowTTInterstitial] = useState(false);
  const [ttPending, setTtPending]     = useState(false);
  const [ttSaved, setTtSaved]         = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localKey  = `inspect_draft_${assignmentId}`;

  // ── Auth + load ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (!profile || !["ridechecker_active", "owner", "admin"].includes(profile.role)) {
        router.push("/auth/login"); return;
      }

      // Load vehicle info
      try {
        const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/detail`);
        if (res.ok) {
          const d = await res.json();
          setVehicle({
            year: d.order?.vehicle_year, make: d.order?.vehicle_make,
            model: d.order?.vehicle_model, trim: d.order?.vehicle_trim,
            address: d.order?.inspection_address, location: d.order?.vehicle_location,
          });
          if (d.order?.id) setOrderId(d.order.id);
          if (d.order?.seller_type) setSellerType(d.order.seller_type);
        }
      } catch { /* vehicle info is non-blocking */ }

      // Try loading existing session
      try {
        const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/inspect/session`);
        if (res.ok) {
          const d = await res.json();
          setSessionId(d.session.id);
          if (d.assignment?.order_id) setOrderId(d.assignment.order_id);
          const map = new Map<string, StepData>();
          for (const s of d.steps ?? []) map.set(s.step_key, s);
          // Merge localStorage backup
          try {
            const saved = localStorage.getItem(localKey);
            if (saved) {
              const parsed = JSON.parse(saved) as Record<string, StepData>;
              for (const [k, v] of Object.entries(parsed)) {
                if (!map.has(k)) map.set(k, v);
              }
            }
          } catch { /* ignore */ }
          setStepData(map);
          setPhase(d.session.status === "submitted" ? "submitted" : "wizard");
          return;
        }
      } catch { /* start fresh */ }

      // LocalStorage fallback
      try {
        const saved = localStorage.getItem(localKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, StepData>;
          setStepData(new Map(Object.entries(parsed)));
        }
      } catch { /* ignore */ }

      setPhase("pre_start");
    })();
  }, [assignmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start session ──────────────────────────────────────────────────────────
  const startSession = async () => {
    setPhase("loading");
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/inspect/session`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: (d as { error?: string }).error || "Could not start inspection", variant: "destructive" });
        setPhase("pre_start"); return;
      }
      const d = await res.json();
      setSessionId(d.session.id);
      if (d.assignment?.order_id) setOrderId(d.assignment.order_id);
      const map = new Map<string, StepData>();
      for (const s of (d.steps ?? []) as StepData[]) map.set(s.step_key, s);
      setStepData(map);
      setPhase("wizard");
    } catch {
      toast({ title: "Failed to start. Check your connection.", variant: "destructive" });
      setPhase("pre_start");
    }
  };

  // ── Auto-save step ─────────────────────────────────────────────────────────
  const scheduleStepSave = useCallback((key: string, data: StepData, immediate = false) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");

    setStepData((prev) => {
      const next = new Map(prev);
      next.set(key, data);
      try {
        const obj: Record<string, StepData> = {};
        next.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem(localKey, JSON.stringify(obj));
      } catch { /* storage may be unavailable */ }
      return next;
    });

    saveTimer.current = setTimeout(async () => {
      try {
        const payload: Record<string, unknown> = { step_key: key };
        if (data.answer        !== undefined) payload.answer         = data.answer;
        if (data.severity      !== undefined) payload.severity       = data.severity;
        if (data.note          !== undefined) payload.note           = data.note;
        if (data.wide_photo_url  !== undefined) payload.wide_photo_url  = data.wide_photo_url;
        if (data.close_photo_url !== undefined) payload.close_photo_url = data.close_photo_url;

        await fetch(`/api/ridechecker/jobs/${assignmentId}/inspect/step`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("idle");
      }
    }, immediate ? 150 : 900);
  }, [assignmentId, localKey]);

  const updateStep = useCallback((key: string, patch: Partial<StepData>, immediate = false) => {
    setStepData((prev) => {
      const next = new Map(prev);
      const existing = next.get(key) ?? { step_key: key };
      const updated: StepData = { ...existing, ...patch, step_key: key };
      next.set(key, updated);
      // Persist localStorage
      try {
        const obj: Record<string, StepData> = {};
        next.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem(localKey, JSON.stringify(obj));
      } catch { /* ignore */ }
      scheduleStepSave(key, updated, immediate);
      return next;
    });
  }, [scheduleStepSave, localKey]);

  // ── Report issue ───────────────────────────────────────────────────────────
  const submitIssue = async () => {
    if (!issueType || !issueNote.trim()) {
      toast({ title: "Select issue type and describe it", variant: "destructive" });
      return;
    }
    setIssueSaving(true);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/inspect/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue_type: issueType, note: issueNote }),
      });
      const d = await res.json() as { error?: string; hold_triggered?: boolean };
      if (!res.ok) { toast({ title: d.error || "Failed to report issue", variant: "destructive" }); return; }
      toast({ title: d.hold_triggered ? "Hold triggered. Ops notified." : "Issue reported to Ops." });
      setIssueOpen(false); setIssueType(""); setIssueNote("");
      if (d.hold_triggered) router.push("/ridechecker/dashboard");
    } catch {
      toast({ title: "Failed to report issue", variant: "destructive" });
    }
    setIssueSaving(false);
  };

  // ── Final submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/inspect/submit`, {
        method: "POST",
      });
      const d = await res.json() as { error?: string; incomplete?: string[] };
      if (!res.ok) {
        if (d.incomplete?.length) {
          toast({ title: `Missing: ${d.incomplete.slice(0, 3).join(", ")}${d.incomplete.length > 3 ? "…" : ""}`, variant: "destructive" });
        } else {
          toast({ title: d.error || "Submission failed", variant: "destructive" });
        }
        return;
      }
      try { localStorage.removeItem(localKey); } catch { /* ignore */ }
      setPhase("submitted");
    } catch {
      toast({ title: "Submission failed. Try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const step           = INSPECTION_STEPS[stepIndex];
  const currentData    = stepData.get(step?.key ?? "") ?? null;
  const vehicleLabel   = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const completedCount = INSPECTION_STEPS.filter((s) => isStepComplete(s, stepData.get(s.key))).length;
  const progressPct    = Math.round((completedCount / INSPECTION_STEPS.length) * 100);
  const currentComplete = step ? isStepComplete(step, currentData) : false;

  const currentSection  = step?.section ?? "";
  const sectionSteps    = INSPECTION_STEPS.filter((s) => s.section === currentSection);
  const sectionDone     = sectionSteps.filter((s) => isStepComplete(s, stepData.get(s.key))).length;
  const sectionStatus   = step
    ? getSectionStatus(step.section as Parameters<typeof getSectionStatus>[0], stepData)
    : "not_started";

  // ── Phase renders ──────────────────────────────────────────────────────────

  if (phase === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (phase === "submitted") return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center space-y-5">
      <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
      </div>
      <h1 className="text-2xl font-bold">Inspection Submitted</h1>
      <p className="text-muted-foreground max-w-sm">
        Great work! The RideCheck team will review your findings before anything is sent to the buyer.
      </p>
      <Button className="h-14 px-10 text-base font-semibold text-white" style={{ background: RC_GREEN }}
        onClick={() => router.push("/ridechecker/dashboard")}>
        Back to Dashboard
      </Button>
    </div>
  );

  if (phase === "pre_start") return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Link href={`/ridechecker/jobs/${assignmentId}`}>
          <button className="p-2 -ml-1 text-muted-foreground" data-testid="button-back-pre-start">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <p className="font-semibold text-sm truncate">{vehicleLabel || "Inspection"}</p>
      </div>

      <div className="flex-1 flex flex-col p-5 space-y-5 max-w-lg mx-auto w-full">
        {/* Hero */}
        <div className="flex flex-col items-center pt-4 pb-2 space-y-3 text-center">
          <div className="h-20 w-20 rounded-full flex items-center justify-center" style={{ background: `${RC_GREEN}18` }}>
            <ClipboardCheck className="h-10 w-10" style={{ color: RC_GREEN }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Guided Inspection</h1>
            <p className="text-muted-foreground mt-1">
              {vehicleLabel || "This vehicle"} — {INSPECTION_STEPS.length} steps
            </p>
          </div>
        </div>

        {/* Location */}
        {(vehicle.address || vehicle.location) && (
          <div className="flex items-start gap-2 rounded-xl border bg-card p-3">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{vehicle.address || vehicle.location}</p>
          </div>
        )}

        {/* Before you begin */}
        <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Before you begin</p>
          <ul className="space-y-2">
            {[
              "Progress saves automatically — safe to exit and return",
              "Each step requires 2 photos (wide angle + close-up)",
              "Use rear camera — tap the big camera button at each step",
              "Photos are compressed automatically before upload",
              "Concerns need a short written note",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Sections overview */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">8 Sections</p>
          <div className="grid grid-cols-2 gap-1.5">
            {SECTIONS.map((sec, i) => (
              <div key={sec} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                <span className="truncate">{sec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SOP disclaimer */}
        <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300 italic">
          "Document visible and accessible condition signals. Do not make repair promises, purchase recommendations, or guarantees to buyers or sellers."
        </div>

        <Button
          className="h-16 text-base font-bold text-white w-full"
          style={{ background: RC_GREEN }}
          onClick={startSession}
          data-testid="button-start-inspection"
        >
          <Camera className="h-5 w-5 mr-2" /> Begin Inspection
        </Button>
      </div>
    </div>
  );

  // ── Review screen ──────────────────────────────────────────────────────────
  if (showReview) {
    const concerns      = INSPECTION_STEPS.filter((s) => stepData.get(s.key)?.answer === "concern");
    const notAccessible = INSPECTION_STEPS.filter((s) => stepData.get(s.key)?.answer === "not_accessible");
    const missing       = INSPECTION_STEPS.filter((s) => !isStepComplete(s, stepData.get(s.key)));
    const totalPhotos   = [...stepData.values()].reduce(
      (a, s) => a + (s.wide_photo_url ? 1 : 0) + (s.close_photo_url ? 1 : 0), 0,
    );

    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background border-b shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <button className="p-1 -ml-1 text-muted-foreground" onClick={() => setShowReview(false)}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <p className="font-semibold">Review & Submit</p>
              <p className="text-xs text-muted-foreground">{completedCount}/{INSPECTION_STEPS.length} steps complete</p>
            </div>
          </div>
          <div className="h-1.5 bg-muted">
            <div className="h-1.5 transition-all duration-300" style={{ width: `${progressPct}%`, background: RC_GREEN }} />
          </div>
        </div>

        <div className="flex-1 p-4 space-y-4 pb-28 max-w-lg mx-auto w-full">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Steps Complete", value: completedCount, color: "text-green-600" },
              { label: "Photos Uploaded", value: totalPhotos, color: "text-blue-600" },
              { label: "Concerns", value: concerns.length, color: concerns.length > 0 ? "text-amber-600" : "text-muted-foreground" },
              { label: "Not Accessible", value: notAccessible.length, color: "text-slate-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border bg-card p-4 text-center">
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Missing steps */}
          {missing.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {missing.length} step{missing.length !== 1 ? "s" : ""} still needed
                </p>
              </div>
              <div className="space-y-1">
                {missing.slice(0, 6).map((s) => (
                  <button
                    key={s.key}
                    className="flex items-center gap-2 w-full text-left text-sm text-red-600 dark:text-red-400 py-1"
                    onClick={() => {
                      setStepIndex(INSPECTION_STEPS.findIndex((x) => x.key === s.key));
                      setShowReview(false);
                      window.scrollTo({ top: 0 });
                    }}
                    data-testid={`button-goto-${s.key}`}
                  >
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    {s.section} — {s.title}
                  </button>
                ))}
                {missing.length > 6 && (
                  <p className="text-xs text-red-500 pl-5">…and {missing.length - 6} more</p>
                )}
              </div>
            </div>
          )}

          {/* Section breakdown */}
          {SECTIONS.map((section) => {
            const secSteps  = INSPECTION_STEPS.filter((s) => s.section === section);
            const secStatus = getSectionStatus(section, stepData);
            const sc        = statusColor(secStatus);
            return (
              <div key={section} className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                    {sc.label}
                  </span>
                </div>
                <div className="divide-y">
                  {secSteps.map((s) => {
                    const d    = stepData.get(s.key);
                    const done = isStepComplete(s, d);
                    const al   = d?.answer ? answerLabel(d.answer) : null;
                    const idx  = INSPECTION_STEPS.findIndex((x) => x.key === s.key);
                    const photos = stepPhotoCount(d);
                    return (
                      <button
                        key={s.key}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 text-left active:bg-muted/60"
                        onClick={() => { setStepIndex(idx); setShowReview(false); window.scrollTo({ top: 0 }); }}
                        data-testid={`button-review-${s.key}`}
                      >
                        {done
                          ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          : <AlertCircle  className="h-4 w-4 text-red-500 shrink-0" />}
                        <span className={`flex-1 text-sm ${!done ? "font-medium text-red-600 dark:text-red-400" : ""}`}>
                          {s.title}
                        </span>
                        {s.requiresPhotos && (
                          <span className={`text-[10px] font-medium ${photos >= s.requiredPhotoCount ? "text-green-600" : "text-amber-600"}`}>
                            {photos}/{s.requiredPhotoCount}
                          </span>
                        )}
                        {al && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${al.cls}`}>{al.text}</span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit footer */}
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-background border-t px-4 py-3 safe-area-pb">
          <Button
            className="w-full h-16 text-base font-bold text-white"
            style={{ background: missing.length === 0 ? RC_GREEN : undefined }}
            disabled={missing.length > 0 || submitting}
            variant={missing.length > 0 ? "secondary" : "default"}
            onClick={handleSubmit}
            data-testid="button-final-submit"
          >
            {submitting
              ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Submitting…</>
              : missing.length > 0
              ? `${missing.length} step${missing.length !== 1 ? "s" : ""} still needed`
              : <><CheckCircle2 className="h-5 w-5 mr-2" />Submit Inspection</>}
          </Button>
        </div>
      </div>
    );
  }

  // ── Main Wizard Step ───────────────────────────────────────────────────────
  const sc = statusColor(sectionStatus);

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background border-b shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Back to job */}
          <Link href={`/ridechecker/jobs/${assignmentId}`}>
            <button className="p-2 -ml-1 text-muted-foreground shrink-0" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>

          {/* Section + step info */}
          <button
            className="flex-1 min-w-0 text-left"
            onClick={() => setShowSectionNav(true)}
            data-testid="button-section-nav"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${sc.bg} ${sc.text}`}>
                {sc.label}
              </span>
              <p className="text-xs text-muted-foreground truncate">{step.section}</p>
              <span className="text-xs text-muted-foreground shrink-0">
                {sectionDone}/{sectionSteps.length}
              </span>
            </div>
            <p className="text-sm font-semibold leading-tight truncate mt-0.5">{step.title}</p>
          </button>

          {/* Save indicator + counter */}
          <div className="flex items-center gap-1.5 shrink-0">
            {saveState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {saveState === "saved"  && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
            <span className="text-xs text-muted-foreground font-medium">
              {stepIndex + 1}/{INSPECTION_STEPS.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted">
          <div
            className="h-1.5 transition-all duration-300"
            style={{ width: `${progressPct}%`, background: RC_GREEN }}
          />
        </div>

        {/* Photo count strip */}
        {step.requiresPhotos && currentData?.answer !== "not_accessible" && (
          <div className="flex items-center justify-between px-4 py-1.5 bg-muted/40 border-b">
            <div className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Photos required
              </span>
            </div>
            <PhotoCountBadge
              count={stepPhotoCount(currentData)}
              required={step.requiredPhotoCount}
            />
          </div>
        )}
      </div>

      {/* ── Step content ───────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-5 space-y-5 pb-32 max-w-lg mx-auto w-full">
        <StepContent
          step={step}
          data={currentData}
          assignmentId={assignmentId}
          orderId={orderId}
          onUpdate={(patch, immediate) => updateStep(step.key, patch, immediate)}
        />
      </div>

      {/* ── Report issue (floating) ─────────────────────────────────────────── */}
      <button
        onClick={() => setIssueOpen(true)}
        className="fixed bottom-20 left-4 z-30 flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-full px-3 py-2.5 shadow-lg active:scale-95"
        data-testid="button-report-issue"
      >
        <ShieldAlert className="h-3.5 w-3.5" /> Report Issue
      </button>

      {/* ── Sticky footer nav ───────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-background border-t px-4 py-3 flex gap-3">
        {stepIndex > 0 && (
          <Button
            variant="outline"
            className="h-14 px-5"
            onClick={() => { setStepIndex((i) => i - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            data-testid="button-prev-step"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        {stepIndex < INSPECTION_STEPS.length - 1 ? (
          <Button
            className={`h-14 font-bold text-white flex-1 ${currentComplete ? "" : ""}`}
            style={{ background: currentComplete ? RC_GREEN : undefined }}
            variant={currentComplete ? "default" : "secondary"}
            disabled={!currentComplete}
            onClick={() => {
              const step = INSPECTION_STEPS[stepIndex];
              if (step.key === "title_paperwork" && sellerType === "private_party") {
                setShowTTInterstitial(true);
                return;
              }
              setStepIndex((i) => i + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            data-testid="button-next-step"
          >
            {!currentComplete
              ? <span className="text-sm">Complete step to continue</span>
              : stepIndex === INSPECTION_STEPS.length - 2
              ? <><ClipboardCheck className="h-5 w-5 mr-2" />Review &amp; Submit</>
              : <>Next Step <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        ) : (
          <Button
            className="h-14 font-bold text-white flex-1"
            style={{ background: currentComplete ? RC_GREEN : undefined }}
            variant={currentComplete ? "default" : "secondary"}
            disabled={!currentComplete}
            onClick={() => setShowReview(true)}
            data-testid="button-go-review"
          >
            <ClipboardCheck className="h-5 w-5 mr-2" /> Review &amp; Submit
          </Button>
        )}
      </div>

      {/* ── Title Transfer Interstitial ─────────────────────────────────────── */}
      {showTTInterstitial && (
        <TitleTransferInterstitial
          orderId={orderId}
          assignmentId={assignmentId}
          saved={ttSaved}
          pending={ttPending}
          onSave={async (data) => {
            setTtPending(true);
            try {
              const res = await fetch(`/api/ridechecker/orders/${orderId}/title-transfer-check`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              if (res.ok) {
                setTtSaved(true);
                setTimeout(() => {
                  setShowTTInterstitial(false);
                  setStepIndex((i) => i + 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }, 800);
              } else {
                const d = await res.json() as { error?: string };
                toast({ title: d.error ?? "Failed to save title check", variant: "destructive" });
              }
            } catch {
              toast({ title: "Failed to save title check", variant: "destructive" });
            } finally {
              setTtPending(false);
            }
          }}
          onSkip={() => {
            setShowTTInterstitial(false);
            setStepIndex((i) => i + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {/* ── Section nav drawer ─────────────────────────────────────────────── */}
      {showSectionNav && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setShowSectionNav(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold text-base">Inspection Sections</h2>
              <button onClick={() => setShowSectionNav(false)} data-testid="button-close-section-nav">
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="divide-y pb-8">
              {SECTIONS.map((section, sIdx) => {
                const secSteps  = INSPECTION_STEPS.filter((s) => s.section === section);
                const secStatus = getSectionStatus(section, stepData);
                const secDone   = secSteps.filter((s) => isStepComplete(s, stepData.get(s.key))).length;
                const sc2       = statusColor(secStatus);
                const firstIdx  = INSPECTION_STEPS.findIndex((s) => s.section === section);
                return (
                  <button
                    key={section}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/40 active:bg-muted/60 text-left"
                    onClick={() => {
                      setStepIndex(firstIdx);
                      setShowSectionNav(false);
                      window.scrollTo({ top: 0 });
                    }}
                    data-testid={`button-nav-section-${sIdx}`}
                  >
                    <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                      {sIdx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{section}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{secDone}/{secSteps.length} steps</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${sc2.bg} ${sc2.text}`}>
                      {sc2.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Report Issue modal ─────────────────────────────────────────────── */}
      {issueOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
          onClick={() => setIssueOpen(false)}
        >
          <div
            className="bg-background w-full max-w-lg rounded-t-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                <h2 className="font-bold text-lg">Report Issue</h2>
              </div>
              <button onClick={() => setIssueOpen(false)}>
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {ISSUE_TYPES.map((it) => (
                <button
                  key={it.value}
                  onClick={() => setIssueType(it.value)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm text-left transition-colors ${
                    issueType === it.value
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-semibold"
                      : "border-border hover:bg-muted/50"
                  }`}
                  data-testid={`button-issue-type-${it.value}`}
                >
                  {it.hold
                    ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    : <div className="h-4 w-4 shrink-0" />}
                  <span className="flex-1">{it.label}</span>
                  {it.hold && (
                    <Badge className="text-xs bg-red-100 text-red-700 border border-red-300">Hold</Badge>
                  )}
                </button>
              ))}
            </div>

            <Textarea
              placeholder="Describe what happened…"
              value={issueNote}
              onChange={(e) => setIssueNote(e.target.value)}
              rows={3}
              className="resize-none text-base"
              data-testid="textarea-issue-note"
            />

            {issueType && ISSUE_TYPES.find((it) => it.value === issueType)?.hold && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-400">
                <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                This will pause the inspection and notify Ops immediately.
              </div>
            )}

            <Button
              className="w-full h-14 font-bold bg-red-600 hover:bg-red-700 text-white"
              disabled={issueSaving || !issueType || !issueNote.trim()}
              onClick={submitIssue}
              data-testid="button-submit-issue"
            >
              {issueSaving
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reporting…</>
                : "Report to Ops"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo count badge
// ─────────────────────────────────────────────────────────────────────────────

function PhotoCountBadge({ count, required }: { count: number; required: number }) {
  const done = count >= required;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
      done
        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        : count > 0
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
    }`}>
      {count}/{required} photos
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TitleTransferInterstitial — shown after title_paperwork for private_party
// ─────────────────────────────────────────────────────────────────────────────

type TTField = "yes" | "no" | "not_applicable" | "unable_to_verify";
type TTYesNoUnable = "yes" | "no" | "unable_to_verify";

interface TTFormData {
  title_present:                 boolean | null;
  seller_name_on_title:          string;
  buyer_name_completed:          TTField | "";
  odometer_disclosure_completed: TTField | "";
  lien_release_present:          TTField | "";
  title_signed:                  TTField | "";
  open_title:                    TTYesNoUnable | "";
  vin_matches_title:             TTYesNoUnable | "";
  state_of_title:                string;
  notes:                         string;
}

function SelectRow({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              value === o.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TitleTransferInterstitial({
  saved, pending, onSave, onSkip,
}: {
  orderId: string;
  assignmentId: string;
  saved: boolean;
  pending: boolean;
  onSave: (data: Partial<TTFormData>) => void;
  onSkip: () => void;
}) {
  const [form, setForm] = useState<TTFormData>({
    title_present: null,
    seller_name_on_title: "",
    buyer_name_completed: "",
    odometer_disclosure_completed: "",
    lien_release_present: "",
    title_signed: "",
    open_title: "",
    vin_matches_title: "",
    state_of_title: "",
    notes: "",
  });

  const set = (k: keyof TTFormData, v: TTFormData[keyof TTFormData]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const ynaOptions = [
    { value: "yes",              label: "Yes" },
    { value: "no",               label: "No" },
    { value: "unable_to_verify", label: "Unable to verify" },
  ];
  const ynnaOptions = [
    { value: "yes",              label: "Yes" },
    { value: "no",               label: "No" },
    { value: "not_applicable",   label: "N/A" },
    { value: "unable_to_verify", label: "Unable" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
      <div className="bg-background w-full max-w-lg rounded-t-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2">
              <span>📋</span> Title &amp; Transfer Check
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Private-party transaction — title review required</p>
          </div>
          <button
            onClick={onSkip}
            className="text-xs text-muted-foreground underline ml-4 shrink-0"
            data-testid="button-tt-skip"
          >
            Skip
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Title present */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title Present at Inspection?</p>
            <div className="flex gap-2">
              {[{ v: true, label: "Yes, present" }, { v: false, label: "Not present" }].map(({ v, label }) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => set("title_present", v)}
                  className={`flex-1 text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${
                    form.title_present === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                  data-testid={`button-tt-title-present-${String(v)}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.title_present !== null && (
            <>
              <SelectRow label="VIN Matches Title?" value={form.vin_matches_title} options={ynaOptions} onChange={(v) => set("vin_matches_title", v as TTYesNoUnable)} />
              <SelectRow label="Open / Blank Title?" value={form.open_title} options={ynaOptions} onChange={(v) => set("open_title", v as TTYesNoUnable)} />

              {form.title_present === true && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seller Name on Title</p>
                  <input
                    type="text"
                    value={form.seller_name_on_title}
                    onChange={(e) => set("seller_name_on_title", e.target.value)}
                    placeholder="As printed on the title"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    data-testid="input-tt-seller-name"
                  />
                </div>
              )}

              <SelectRow label="Title Signed by Seller?" value={form.title_signed} options={ynnaOptions} onChange={(v) => set("title_signed", v as TTField)} />
              <SelectRow label="Buyer Name Section Completed?" value={form.buyer_name_completed} options={ynnaOptions} onChange={(v) => set("buyer_name_completed", v as TTField)} />
              <SelectRow label="Odometer Disclosure Completed?" value={form.odometer_disclosure_completed} options={ynnaOptions} onChange={(v) => set("odometer_disclosure_completed", v as TTField)} />
              <SelectRow label="Lien Release Present?" value={form.lien_release_present} options={ynnaOptions} onChange={(v) => set("lien_release_present", v as TTField)} />

              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">State of Title (if visible)</p>
                <input
                  type="text"
                  value={form.state_of_title}
                  onChange={(e) => set("state_of_title", e.target.value)}
                  placeholder="e.g. IL, WI, or Out of State"
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  data-testid="input-tt-state-of-title"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes (optional)</p>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any other observations about the title or transfer documents…"
              rows={2}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              data-testid="textarea-tt-notes"
            />
          </div>

          <p className="text-[11px] text-muted-foreground leading-snug">
            This review is observational only. Do not provide legal advice. If you are uncertain, select "Unable to verify."
          </p>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t px-5 py-4 flex gap-3">
          <button
            onClick={onSkip}
            className="flex-none text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted/40"
            data-testid="button-tt-skip-footer"
          >
            Skip
          </button>
          <button
            disabled={pending || saved}
            onClick={() => onSave({
              title_present:                 form.title_present,
              seller_name_on_title:          form.seller_name_on_title || undefined,
              buyer_name_completed:          (form.buyer_name_completed || undefined) as TTField | undefined,
              odometer_disclosure_completed: (form.odometer_disclosure_completed || undefined) as TTField | undefined,
              lien_release_present:          (form.lien_release_present || undefined) as TTField | undefined,
              title_signed:                  (form.title_signed || undefined) as TTField | undefined,
              open_title:                    (form.open_title || undefined) as TTYesNoUnable | undefined,
              vin_matches_title:             (form.vin_matches_title || undefined) as TTYesNoUnable | undefined,
              state_of_title:                form.state_of_title || undefined,
              notes:                         form.notes || undefined,
            })}
            className={`flex-1 text-sm px-4 py-2 rounded-lg font-semibold text-white transition-colors ${
              saved ? "bg-green-600" : pending ? "bg-primary/60 cursor-not-allowed" : "bg-primary"
            }`}
            style={{ background: saved ? undefined : RC_GREEN }}
            data-testid="button-tt-save"
          >
            {saved ? "✓ Saved!" : pending ? "Saving…" : "Save & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StepContent — renders a single step
// ─────────────────────────────────────────────────────────────────────────────

function StepContent({
  step, data, assignmentId, orderId, onUpdate,
}: {
  step: InspectionStep;
  data: StepData | null;
  assignmentId: string;
  orderId: string;
  onUpdate: (patch: Partial<StepData>, immediate?: boolean) => void;
}) {
  const answer    = data?.answer ?? null;
  const needsNote = answer === "concern" || answer === "not_accessible";
  const isSummary = step.key === "field_summary";

  return (
    <div className="space-y-5">
      {/* "Why it matters" */}
      <div className="flex items-start gap-2.5 rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 px-4 py-3">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Why this matters</p>
          <p className="text-sm text-blue-800 dark:text-blue-300">{step.whyItMatters}</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 px-4 py-3">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-relaxed">{step.instruction}</p>
      </div>

      {/* Photos */}
      {step.requiresPhotos && answer !== "not_accessible" && (
        <div className="space-y-5">
          {/* Wide photo */}
          <MobilePhotoCapture
            label={step.widePhotoLabel || "Wide angle photo"}
            hint={step.widePhotoHint}
            value={data?.wide_photo_url ?? ""}
            onChange={(url) => onUpdate({ wide_photo_url: url }, true)}
            assignmentId={assignmentId}
            orderId={orderId}
            stepKey={step.key}
            slotKey="wide"
            required
          />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" />
            <span className="text-xs text-muted-foreground font-medium">then</span>
            <div className="flex-1 border-t" />
          </div>

          {/* Close photo */}
          <MobilePhotoCapture
            label={step.closePhotoLabel || "Close-up photo"}
            hint={step.closePhotoHint}
            value={data?.close_photo_url ?? ""}
            onChange={(url) => onUpdate({ close_photo_url: url }, true)}
            assignmentId={assignmentId}
            orderId={orderId}
            stepKey={step.key}
            slotKey="close"
            required
          />
        </div>
      )}

      {/* Assessment buttons */}
      {!isSummary && (
        <div className="space-y-2.5">
          <p className="text-sm font-semibold">Your assessment</p>
          <div className={`grid gap-3 ${step.allowNotAccessible ? "grid-cols-3" : "grid-cols-2"}`}>
            <AnswerButton
              label="Looks OK"
              value="pass"
              active={answer === "pass"}
              color="green"
              onClick={() => onUpdate({ answer: "pass", severity: null }, true)}
              testId={`button-answer-pass-${step.key}`}
            />
            <AnswerButton
              label="Concern"
              value="concern"
              active={answer === "concern"}
              color="amber"
              onClick={() => onUpdate({ answer: "concern" }, true)}
              testId={`button-answer-concern-${step.key}`}
            />
            {step.allowNotAccessible && (
              <AnswerButton
                label="N/A"
                value="not_accessible"
                active={answer === "not_accessible"}
                color="slate"
                onClick={() => onUpdate({ answer: "not_accessible" }, true)}
                testId={`button-answer-na-${step.key}`}
              />
            )}
          </div>
        </div>
      )}

      {/* Severity */}
      {answer === "concern" && !isSummary && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Severity</p>
          <div className="grid grid-cols-4 gap-2">
            {(["low", "medium", "high", "critical"] as const).map((sev) => {
              const active = data?.severity === sev;
              const activeStyle = sev === "critical" ? "bg-red-600 text-white border-red-600"
                : sev === "high"     ? "bg-orange-500 text-white border-orange-500"
                : sev === "medium"   ? "bg-amber-400 text-white border-amber-400"
                : "bg-green-500 text-white border-green-500";
              return (
                <button
                  key={sev}
                  onClick={() => onUpdate({ severity: sev }, true)}
                  className={`h-11 rounded-xl border text-xs font-semibold capitalize transition-all active:scale-95 ${
                    active ? activeStyle : "bg-muted/40 hover:bg-muted/60 border-border"
                  }`}
                  data-testid={`button-severity-${sev}-${step.key}`}
                >
                  {sev}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Note / summary */}
      {isSummary ? (
        <SummaryFields data={data} onUpdate={onUpdate} />
      ) : (
        (needsNote || (answer && answer !== "pass")) && (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">
              {answer === "concern"
                ? "Describe the concern"
                : answer === "not_accessible"
                ? "Why not accessible?"
                : "Additional notes (optional)"}
              {needsNote && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Textarea
              placeholder={
                answer === "concern"        ? "Describe what you observed…" :
                answer === "not_accessible" ? "Explain why you could not access this…" :
                "Any additional observations…"
              }
              value={data?.note ?? ""}
              onChange={(e) => onUpdate({ note: e.target.value })}
              rows={3}
              className="resize-none text-base"
              data-testid={`textarea-note-${step.key}`}
            />
            {needsNote && !data?.note?.trim() && (
              <p className="text-xs text-red-500">Required to complete this step</p>
            )}
          </div>
        )
      )}

      {/* Step complete indicator */}
      {isStepComplete(step, data) && (
        <div className="flex items-center gap-2.5 rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">Step complete — tap Next to continue</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary step fields
// ─────────────────────────────────────────────────────────────────────────────

function SummaryFields({ data, onUpdate }: {
  data: StepData | null;
  onUpdate: (patch: Partial<StepData>, immediate?: boolean) => void;
}) {
  const answer = data?.answer ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300 italic">
        "Do not tell the buyer whether to buy. Submit your findings for RideCheck review."
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold">
          Overall Field Assessment <span className="text-red-500">*</span>
        </label>
        <Textarea
          placeholder="Summarize your findings overall. Include anything not captured in individual steps."
          value={data?.note ?? ""}
          onChange={(e) => onUpdate({ note: e.target.value })}
          rows={5}
          className="resize-none text-base"
          data-testid="textarea-field-summary"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Ops Recommendation <span className="text-red-500">*</span></p>
        <p className="text-xs text-muted-foreground">Internal only — buyer never sees this.</p>
        <div className="space-y-2">
          {[
            {
              value: "pass", severity: null,
              label: "No Obvious Concern",
              desc: "Findings are typical for the vehicle age and mileage.",
              active: "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300",
            },
            {
              value: "concern", severity: "medium",
              label: "Needs Review",
              desc: "Some concerns — Ops should review before report release.",
              active: "border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300",
            },
            {
              value: "concern", severity: "critical",
              label: "Urgent — Safety Issue",
              desc: "Critical concern. Ops must review immediately.",
              active: "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300",
            },
          ].map((opt) => {
            const isActive = answer === opt.value && (opt.severity ? data?.severity === opt.severity : !data?.severity || data.severity === null);
            return (
              <button
                key={`${opt.value}-${opt.severity}`}
                onClick={() => onUpdate({ answer: opt.value, severity: opt.severity }, true)}
                className={`flex items-start gap-3 w-full px-4 py-3 rounded-xl border-2 text-left transition-colors active:scale-[0.99] ${
                  isActive ? opt.active : "border-border hover:bg-muted/40"
                }`}
                data-testid={`button-summary-${opt.value}-${opt.severity ?? "none"}`}
              >
                <div className={`h-5 w-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                  isActive ? "border-current" : "border-muted-foreground"
                }`}>
                  {isActive && <div className="h-2.5 w-2.5 rounded-full bg-current" />}
                </div>
                <div>
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs opacity-75 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AnswerButton
// ─────────────────────────────────────────────────────────────────────────────

function AnswerButton({
  label, value, active, color, onClick, testId,
}: {
  label: string; value: string; active: boolean;
  color: "green" | "amber" | "slate"; onClick: () => void; testId: string;
}) {
  const activeStyles = {
    green: "bg-green-600 text-white border-green-600 shadow-md",
    amber: "bg-amber-500 text-white border-amber-500 shadow-md",
    slate: "bg-slate-500 text-white border-slate-500 shadow-md",
  }[color];

  const icons: Record<string, React.ReactNode> = {
    pass:           <CheckCircle2 className="h-5 w-5 mb-1" />,
    concern:        <AlertCircle  className="h-5 w-5 mb-1" />,
    not_accessible: <XCircle      className="h-5 w-5 mb-1" />,
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-4 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95 ${
        active ? activeStyles : "border-border bg-muted/20 hover:bg-muted/50 text-foreground"
      }`}
      data-testid={testId}
    >
      {icons[value]}
      {label}
    </button>
  );
}
