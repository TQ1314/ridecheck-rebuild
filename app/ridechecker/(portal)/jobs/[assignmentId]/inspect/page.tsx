"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/ridechecker/PhotoUpload";
import {
  INSPECTION_STEPS, isStepComplete, ISSUE_TYPES, SECTIONS,
  type StepData, type InspectionStep,
} from "@/lib/inspection/steps";
import {
  ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, XCircle,
  AlertTriangle, Loader2, ClipboardCheck, Camera, ChevronRight,
  Info, ShieldAlert,
} from "lucide-react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VehicleInfo {
  year?: string; make?: string; model?: string; trim?: string;
  address?: string; location?: string;
}

type Phase = "loading" | "pre_start" | "wizard" | "submitted";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function answerLabel(answer: string | null | undefined) {
  if (answer === "pass")           return { text: "Looks OK",       cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300" };
  if (answer === "concern")        return { text: "Concern",         cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300" };
  if (answer === "not_accessible") return { text: "Not Accessible",  cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300" };
  return null;
}

const RC_GREEN = "#22774F";

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function InspectWizardPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.assignmentId as string;
  const { toast } = useToast();
  const supabase = createClient();

  const [phase, setPhase]               = useState<Phase>("loading");
  const [sessionId, setSessionId]       = useState<string | null>(null);
  const [vehicle, setVehicle]           = useState<VehicleInfo>({});
  const [stepIndex, setStepIndex]       = useState(0);
  const [stepData, setStepData]         = useState<Map<string, StepData>>(new Map());
  const [issueOpen, setIssueOpen]       = useState(false);
  const [issueType, setIssueType]       = useState("");
  const [issueNote, setIssueNote]       = useState("");
  const [issueSaving, setIssueSaving]   = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [showReview, setShowReview]     = useState(false);
  const [saveState, setSaveState]       = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localKey = `inspect_draft_${assignmentId}`;

  // ── Auth + load ─────────────────────────────────────────────────────────
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
        }
      } catch {}

      // Try loading existing session
      try {
        const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/inspect/session`);
        if (res.ok) {
          const d = await res.json();
          setSessionId(d.session.id);
          const map = new Map<string, StepData>();
          for (const s of d.steps ?? []) map.set(s.step_key, s);
          // Merge with localStorage backup
          try {
            const saved = localStorage.getItem(localKey);
            if (saved) {
              const parsed = JSON.parse(saved);
              for (const [k, v] of Object.entries(parsed)) {
                if (!map.has(k)) map.set(k, v as StepData);
              }
            }
          } catch {}
          setStepData(map);
          setPhase(d.session.status === "submitted" ? "submitted" : "wizard");
          return;
        }
      } catch {}

      // Try localStorage backup
      try {
        const saved = localStorage.getItem(localKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          const map = new Map<string, StepData>(Object.entries(parsed));
          setStepData(map);
        }
      } catch {}

      setPhase("pre_start");
    })();
  }, [assignmentId]);

  // ── Start session ─────────────────────────────────────────────────────────
  const startSession = async () => {
    setPhase("loading");
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/inspect/session`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: d.error || "Could not start inspection", variant: "destructive" });
        setPhase("pre_start"); return;
      }
      const d = await res.json();
      setSessionId(d.session.id);
      const map = new Map<string, StepData>();
      for (const s of d.steps ?? []) map.set(s.step_key, s);
      setStepData(map);
      setPhase("wizard");
    } catch {
      toast({ title: "Failed to start. Check your connection.", variant: "destructive" });
      setPhase("pre_start");
    }
  };

  // ── Auto-save step ────────────────────────────────────────────────────────
  const scheduleStepSave = useCallback((key: string, data: StepData, immediate = false) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");

    // Always update localStorage immediately
    setStepData((prev) => {
      const next = new Map(prev);
      next.set(key, data);
      try {
        const obj: Record<string, StepData> = {};
        next.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem(localKey, JSON.stringify(obj));
      } catch {}
      return next;
    });

    const delay = immediate ? 100 : 900;
    saveTimer.current = setTimeout(async () => {
      try {
        const payload: Record<string, unknown> = { step_key: key };
        if (data.answer !== undefined)         payload.answer          = data.answer;
        if (data.severity !== undefined)       payload.severity        = data.severity;
        if (data.note !== undefined)           payload.note            = data.note;
        if (data.wide_photo_url !== undefined) payload.wide_photo_url  = data.wide_photo_url;
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
    }, delay);
  }, [assignmentId, localKey]);

  const updateStep = useCallback((key: string, patch: Partial<StepData>, immediate = false) => {
    setStepData((prev) => {
      const existing = prev.get(key) ?? { step_key: key };
      const updated: StepData = { ...existing, ...patch, step_key: key };
      scheduleStepSave(key, updated, immediate);
      return prev; // scheduleStepSave sets the actual new state via its own setStepData
    });
    // Also set immediately for smooth UI
    setStepData((prev) => {
      const next = new Map(prev);
      const existing = next.get(key) ?? { step_key: key };
      next.set(key, { ...existing, ...patch, step_key: key });
      return next;
    });
  }, [scheduleStepSave]);

  // ── Report issue ──────────────────────────────────────────────────────────
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
      const d = await res.json();
      if (!res.ok) { toast({ title: d.error || "Failed to report issue", variant: "destructive" }); return; }
      toast({ title: d.hold_triggered ? "Hold triggered. Ops has been notified." : "Issue reported to Ops." });
      setIssueOpen(false); setIssueType(""); setIssueNote("");
      if (d.hold_triggered) router.push("/ridechecker/dashboard");
    } catch { toast({ title: "Failed to report issue", variant: "destructive" }); }
    setIssueSaving(false);
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/inspect/submit`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.incomplete?.length) {
          toast({ title: `Missing: ${d.incomplete.slice(0,3).join(", ")}${d.incomplete.length > 3 ? "…" : ""}`, variant: "destructive" });
        } else {
          toast({ title: d.error || "Submission failed", variant: "destructive" });
        }
        return;
      }
      try { localStorage.removeItem(localKey); } catch {}
      setPhase("submitted");
    } catch { toast({ title: "Submission failed. Try again.", variant: "destructive" }); }
    setSubmitting(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────────────────────────────────────
  const step = INSPECTION_STEPS[stepIndex];
  const currentData = stepData.get(step?.key ?? "") ?? null;
  const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const completedCount = INSPECTION_STEPS.filter((s) => isStepComplete(s, stepData.get(s.key))).length;
  const progressPct = Math.round((completedCount / INSPECTION_STEPS.length) * 100);
  const currentComplete = step ? isStepComplete(step, currentData) : false;

  // ─────────────────────────────────────────────────────────────────────────
  // Renders
  // ─────────────────────────────────────────────────────────────────────────

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
      <p className="text-muted-foreground max-w-sm">Great work! The RideCheck team will review your findings before anything is sent to the buyer.</p>
      <Button className="h-12 px-8" style={{ background: RC_GREEN }} onClick={() => router.push("/ridechecker/dashboard")}>
        Back to Dashboard
      </Button>
    </div>
  );

  if (phase === "pre_start") return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Link href={`/ridechecker/jobs/${assignmentId}`}>
          <button className="p-1 -ml-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></button>
        </Link>
        <p className="font-semibold text-sm truncate">{vehicleLabel || "Inspection"}</p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="h-20 w-20 rounded-full flex items-center justify-center" style={{ background: `${RC_GREEN}20` }}>
          <ClipboardCheck className="h-10 w-10" style={{ color: RC_GREEN }} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Guided Inspection</h1>
          <p className="text-muted-foreground">
            {vehicleLabel || "This vehicle"} — {INSPECTION_STEPS.length} step inspection
          </p>
        </div>
        <div className="max-w-sm rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-4 text-left space-y-2">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Before you begin</p>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
            <li>Progress saves automatically</li>
            <li>Each step needs 2 photos (wide + close)</li>
            <li>Tap "Looks OK", "Concern", or "Not Accessible"</li>
            <li>Concerns require a short note</li>
          </ul>
        </div>
        <div className="max-w-sm rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300 italic">
          "RideCheckers document visible and accessible condition signals. Do not make repair promises, purchase recommendations, or guarantees to buyers or sellers."
        </div>
        <Button
          className="h-14 px-10 text-base font-semibold text-white"
          style={{ background: RC_GREEN }}
          onClick={startSession}
          data-testid="button-start-inspection"
        >
          <ClipboardCheck className="h-5 w-5 mr-2" /> Start Inspection
        </Button>
      </div>
    </div>
  );

  // ── Review screen ──────────────────────────────────────────────────────────
  if (showReview) {
    const concerns     = INSPECTION_STEPS.filter((s) => stepData.get(s.key)?.answer === "concern");
    const notAccessible = INSPECTION_STEPS.filter((s) => stepData.get(s.key)?.answer === "not_accessible");
    const missing = INSPECTION_STEPS.filter((s) => !isStepComplete(s, stepData.get(s.key)));
    const photoCount = [...stepData.values()].reduce(
      (a, s) => a + (s.wide_photo_url ? 1 : 0) + (s.close_photo_url ? 1 : 0), 0
    );

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="sticky top-0 z-20 bg-background border-b shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <button className="p-1 -ml-1 text-muted-foreground hover:text-foreground" onClick={() => setShowReview(false)}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <p className="font-semibold">Review & Submit</p>
              <p className="text-xs text-muted-foreground">{completedCount}/{INSPECTION_STEPS.length} steps complete</p>
            </div>
          </div>
          <div className="h-1 bg-muted">
            <div className="h-1 transition-all duration-300" style={{ width: `${progressPct}%`, background: RC_GREEN }} />
          </div>
        </div>

        <div className="flex-1 p-4 space-y-4 pb-28">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Complete",     value: completedCount, color: "text-green-600" },
              { label: "Photos",       value: photoCount,     color: "text-blue-600" },
              { label: "Concerns",     value: concerns.length, color: concerns.length > 0 ? "text-amber-600" : "text-muted-foreground" },
              { label: "Not Accessible", value: notAccessible.length, color: "text-slate-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border bg-card p-3 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Missing steps warning */}
          {missing.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {missing.length} step{missing.length !== 1 ? "s" : ""} still required
                </p>
              </div>
              <div className="space-y-1">
                {missing.slice(0, 5).map((s) => (
                  <button
                    key={s.key}
                    className="flex items-center gap-2 w-full text-left text-sm text-red-600 dark:text-red-400 py-0.5"
                    onClick={() => { setStepIndex(INSPECTION_STEPS.findIndex((x) => x.key === s.key)); setShowReview(false); }}
                    data-testid={`button-goto-step-${s.key}`}
                  >
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" /> {s.section} — {s.title}
                  </button>
                ))}
                {missing.length > 5 && <p className="text-xs text-red-500">…and {missing.length - 5} more</p>}
              </div>
            </div>
          )}

          {/* All steps summary */}
          {SECTIONS.map((section) => {
            const sectionSteps = INSPECTION_STEPS.filter((s) => s.section === section);
            return (
              <div key={section} className="rounded-xl border bg-card overflow-hidden">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2.5 border-b bg-muted/30">
                  {section}
                </p>
                <div className="divide-y">
                  {sectionSteps.map((s) => {
                    const d = stepData.get(s.key);
                    const done = isStepComplete(s, d);
                    const al = d?.answer ? answerLabel(d.answer) : null;
                    const idx = INSPECTION_STEPS.findIndex((x) => x.key === s.key);
                    return (
                      <button
                        key={s.key}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 text-left"
                        onClick={() => { setStepIndex(idx); setShowReview(false); }}
                        data-testid={`button-review-${s.key}`}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                               : <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        <span className={`flex-1 text-sm ${!done ? "font-medium text-red-600 dark:text-red-400" : ""}`}>{s.title}</span>
                        {al && <span className={`text-xs px-2 py-0.5 rounded-full border ${al.cls}`}>{al.text}</span>}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20 bg-background border-t px-4 py-3">
          <Button
            className="w-full h-14 text-base font-semibold text-white"
            style={{ background: missing.length > 0 ? undefined : RC_GREEN }}
            disabled={missing.length > 0 || submitting}
            variant={missing.length > 0 ? "secondary" : "default"}
            onClick={handleSubmit}
            data-testid="button-final-submit"
          >
            {submitting ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Submitting…</>
                        : missing.length > 0 ? `${missing.length} step${missing.length !== 1 ? "s" : ""} still needed`
                        : <><CheckCircle2 className="h-5 w-5 mr-2" />Submit Inspection</>}
          </Button>
        </div>
      </div>
    );
  }

  // ── Wizard step ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background border-b shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={`/ridechecker/jobs/${assignmentId}`}>
            <button className="p-1 -ml-1 text-muted-foreground hover:text-foreground" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{step.section}</p>
            <p className="text-sm font-semibold leading-tight truncate">{step.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {saveState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {saveState === "saved"  && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
            <span className="text-xs text-muted-foreground">{stepIndex + 1}/{INSPECTION_STEPS.length}</span>
          </div>
        </div>
        <div className="h-1 bg-muted">
          <div className="h-1 transition-all duration-300" style={{ width: `${progressPct}%`, background: RC_GREEN }} />
        </div>
      </div>

      {/* ── Step content ──────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-5 space-y-5 pb-28 max-w-lg mx-auto w-full">
        <StepContent
          step={step}
          data={currentData}
          assignmentId={assignmentId}
          onUpdate={(patch, immediate) => updateStep(step.key, patch, immediate)}
        />
      </div>

      {/* ── Floating report issue button ───────────────────────────────── */}
      <button
        onClick={() => setIssueOpen(true)}
        className="fixed bottom-20 left-4 z-30 flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-full px-3 py-2 shadow-md"
        data-testid="button-report-issue"
      >
        <ShieldAlert className="h-3.5 w-3.5" /> Report Issue
      </button>

      {/* ── Bottom nav ────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-background border-t px-4 py-3 flex gap-3">
        {stepIndex > 0 && (
          <Button variant="outline" className="flex-1 h-12"
            onClick={() => { setStepIndex((i) => i - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            data-testid="button-prev-step">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        )}
        {stepIndex < INSPECTION_STEPS.length - 1 ? (
          <Button
            className={`h-12 font-semibold text-white ${stepIndex > 0 ? "flex-[2]" : "w-full"}`}
            style={{ background: currentComplete ? RC_GREEN : undefined }}
            variant={currentComplete ? "default" : "secondary"}
            disabled={!currentComplete}
            onClick={() => { setStepIndex((i) => i + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            data-testid="button-next-step"
          >
            {!currentComplete ? "Complete this step first" : stepIndex === INSPECTION_STEPS.length - 2
              ? <><ClipboardCheck className="h-4 w-4 mr-2" />Review &amp; Submit</>
              : <>Next <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        ) : (
          <Button
            className={`h-12 font-semibold text-white ${stepIndex > 0 ? "flex-[2]" : "w-full"}`}
            style={{ background: currentComplete ? RC_GREEN : undefined }}
            variant={currentComplete ? "default" : "secondary"}
            disabled={!currentComplete}
            onClick={() => setShowReview(true)}
            data-testid="button-go-review"
          >
            <ClipboardCheck className="h-4 w-4 mr-2" /> Review &amp; Submit
          </Button>
        )}
      </div>

      {/* ── Report Issue Modal ─────────────────────────────────────────── */}
      {issueOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setIssueOpen(false)}>
          <div className="bg-background w-full max-w-lg rounded-t-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                <h2 className="font-bold text-lg">Report Issue</h2>
              </div>
              <button onClick={() => setIssueOpen(false)}><XCircle className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {ISSUE_TYPES.map((it) => (
                <button
                  key={it.value}
                  onClick={() => setIssueType(it.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                    issueType === it.value
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-medium"
                      : "border-border hover:bg-muted/50"
                  }`}
                  data-testid={`button-issue-type-${it.value}`}
                >
                  {it.hold && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  {!it.hold && <div className="h-3.5 w-3.5 shrink-0" />}
                  {it.label}
                  {it.hold && <Badge className="ml-auto text-xs bg-red-100 text-red-700 border-red-300">Hold</Badge>}
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Describe what happened…"
              value={issueNote}
              onChange={(e) => setIssueNote(e.target.value)}
              rows={3}
              className="resize-none"
              data-testid="textarea-issue-note"
            />
            {issueType && ISSUE_TYPES.find((it) => it.value === issueType)?.hold && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-400">
                <AlertTriangle className="inline h-3 w-3 mr-1" />
                This will pause the inspection and notify Ops immediately.
              </div>
            )}
            <Button
              className="w-full h-12 font-semibold bg-red-600 hover:bg-red-700 text-white"
              disabled={issueSaving || !issueType || !issueNote.trim()}
              onClick={submitIssue}
              data-testid="button-submit-issue"
            >
              {issueSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reporting…</> : "Report to Ops"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StepContent — renders a single step
// ─────────────────────────────────────────────────────────────────────────────

function StepContent({
  step, data, assignmentId, onUpdate,
}: {
  step: InspectionStep;
  data: StepData | null;
  assignmentId: string;
  onUpdate: (patch: Partial<StepData>, immediate?: boolean) => void;
}) {
  const answer = data?.answer ?? null;
  const needsNote = answer === "concern" || answer === "not_accessible";
  const isSummary = step.key === "field_summary";

  return (
    <div className="space-y-5">
      {/* Step header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{step.section}</span>
        </div>
        <h2 className="text-xl font-bold">{step.title}</h2>
        <div className="flex items-start gap-2 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 px-3 py-2.5">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Why this matters</p>
            <p className="text-sm text-blue-700 dark:text-blue-400">{step.whyItMatters}</p>
          </div>
        </div>
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 px-3 py-2.5">
          <p className="text-sm text-amber-800 dark:text-amber-300">{step.instruction}</p>
        </div>
      </div>

      {/* Photos — not for summary step */}
      {step.requiresPhotos && answer !== "not_accessible" && (
        <div className="space-y-4">
          <PhotoUpload
            label={step.widePhotoLabel || "Wide photo"}
            hint={step.widePhotoHint}
            fieldKey={`${step.key}_wide`}
            value={data?.wide_photo_url ?? ""}
            onChange={(url) => onUpdate({ wide_photo_url: url }, true)}
            assignmentId={assignmentId}
            required
          />
          <PhotoUpload
            label={step.closePhotoLabel || "Close photo"}
            hint={step.closePhotoHint}
            fieldKey={`${step.key}_close`}
            value={data?.close_photo_url ?? ""}
            onChange={(url) => onUpdate({ close_photo_url: url }, true)}
            assignmentId={assignmentId}
            required
          />
        </div>
      )}

      {/* Answer buttons */}
      {!isSummary && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Your assessment</p>
          <div className={`grid gap-2 ${step.allowNotAccessible ? "grid-cols-3" : "grid-cols-2"}`}>
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
                label="Not Accessible"
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

      {/* Severity — only for concerns */}
      {answer === "concern" && !isSummary && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Severity</p>
          <div className="grid grid-cols-4 gap-2">
            {(["low", "medium", "high", "critical"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => onUpdate({ severity: sev }, true)}
                className={`h-9 rounded-lg border text-xs font-medium capitalize transition-colors ${
                  data?.severity === sev
                    ? sev === "critical" ? "bg-red-600 text-white border-red-600"
                    : sev === "high"     ? "bg-orange-500 text-white border-orange-500"
                    : sev === "medium"   ? "bg-amber-400 text-white border-amber-400"
                    : "bg-green-500 text-white border-green-500"
                    : "bg-muted/40 hover:bg-muted/60 border-border"
                }`}
                data-testid={`button-severity-${sev}-${step.key}`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Note field */}
      {isSummary ? (
        <SummaryFields data={data} onUpdate={onUpdate} />
      ) : (
        (needsNote || answer) && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {answer === "concern" ? "Describe the concern" : answer === "not_accessible" ? "Why not accessible?" : "Additional notes (optional)"}
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
            {needsNote && !(data?.note?.trim()) && (
              <p className="text-xs text-red-500">Note required to complete this step</p>
            )}
          </div>
        )
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
  const [overall, setOverall]   = useState(data?.note ?? "");
  const answer = data?.answer ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300 italic">
        "Do not tell the buyer whether to buy the vehicle. Submit your findings for RideCheck review."
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Overall Field Assessment <span className="text-red-500">*</span></label>
        <Textarea
          placeholder="Summarize your findings overall. Include anything not captured in individual steps."
          value={overall}
          onChange={(e) => { setOverall(e.target.value); onUpdate({ note: e.target.value }); }}
          rows={4}
          className="resize-none text-base"
          data-testid="textarea-field-summary"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Recommendation for Ops <span className="text-red-500">*</span></p>
        <p className="text-xs text-muted-foreground">This is internal — the buyer never sees this.</p>
        <div className="grid grid-cols-1 gap-2">
          {[
            { value: "pass",    label: "No Obvious Concern",     desc: "Findings are typical for the vehicle age and mileage.", cls: "border-green-400 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300" },
            { value: "concern", label: "Needs Review",           desc: "Some concerns found — Ops should review before report release.", cls: "border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ answer: opt.value, severity: opt.value === "concern" ? "medium" : null }, true)}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                answer === opt.value ? opt.cls : "border-border hover:bg-muted/40"
              }`}
              data-testid={`button-summary-answer-${opt.value}`}
            >
              <div className={`h-5 w-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                answer === opt.value ? "border-current" : "border-muted-foreground"
              }`}>
                {answer === opt.value && <div className="h-2.5 w-2.5 rounded-full bg-current" />}
              </div>
              <div>
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs opacity-80">{opt.desc}</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => onUpdate({ answer: "concern", severity: "critical" }, true)}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
              answer === "concern" && data?.severity === "critical"
                ? "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300"
                : "border-border hover:bg-muted/40"
            }`}
            data-testid="button-summary-answer-urgent"
          >
            <div className={`h-5 w-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
              answer === "concern" && data?.severity === "critical" ? "border-red-600" : "border-muted-foreground"
            }`}>
              {answer === "concern" && data?.severity === "critical" && <div className="h-2.5 w-2.5 rounded-full bg-red-600" />}
            </div>
            <div>
              <p className="font-semibold text-sm text-red-700 dark:text-red-400">Urgent Review — Safety Issue</p>
              <p className="text-xs opacity-80">Critical concern that Ops must review immediately before anything proceeds.</p>
            </div>
          </button>
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
    green: "bg-green-600 text-white border-green-600",
    amber: "bg-amber-500 text-white border-amber-500",
    slate: "bg-slate-500 text-white border-slate-500",
  }[color];

  const icons = {
    pass:           <CheckCircle2 className="h-4 w-4 mr-1.5" />,
    concern:        <AlertCircle className="h-4 w-4 mr-1.5" />,
    not_accessible: <XCircle className="h-4 w-4 mr-1.5" />,
  }[value];

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center h-12 rounded-xl border-2 text-sm font-semibold transition-all ${
        active ? activeStyles : "border-border bg-muted/30 hover:bg-muted/60 text-foreground"
      }`}
      data-testid={testId}
    >
      {icons}
      {label}
    </button>
  );
}
