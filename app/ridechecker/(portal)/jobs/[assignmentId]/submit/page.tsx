"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/ridechecker/PhotoUpload";
import {
  Camera,
  Car,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Gauge,
  Wrench,
  MapPin,
  ClipboardCheck,
  Eye,
  Loader2,
  Navigation,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssignmentDetails {
  id: string;
  order_id: string;
  status: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_trim?: string;
  vehicle_location?: string;
  inspection_address?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  special_instructions?: string;
}

interface FormData {
  vin_photo_url: string;
  odometer_photo_url: string;
  under_hood_photo_url: string;
  undercarriage_photo_url: string;
  tire_tread_mm_front_left: string;
  tire_tread_mm_front_right: string;
  tire_tread_mm_rear_left: string;
  tire_tread_mm_rear_right: string;
  brake_condition: string;
  scan_codes: string[];
  cosmetic_exterior: string;
  interior_condition: string;
  mechanical_issues: string;
  test_drive_notes: string;
  immediate_concerns: string;
  audio_note_url: string;
  extra_photos: string[];
}

const EMPTY_FORM: FormData = {
  vin_photo_url: "",
  odometer_photo_url: "",
  under_hood_photo_url: "",
  undercarriage_photo_url: "",
  tire_tread_mm_front_left: "",
  tire_tread_mm_front_right: "",
  tire_tread_mm_rear_left: "",
  tire_tread_mm_rear_right: "",
  brake_condition: "",
  scan_codes: [],
  cosmetic_exterior: "",
  interior_condition: "",
  mechanical_issues: "",
  test_drive_notes: "",
  immediate_concerns: "",
  audio_note_url: "",
  extra_photos: [],
};

// ── Steps definition ──────────────────────────────────────────────────────────

const STEPS = [
  { id: "confirm",       title: "Confirm Vehicle",   icon: Car },
  { id: "vin",          title: "VIN Photo",          icon: Camera },
  { id: "odometer",     title: "Odometer",           icon: Gauge },
  { id: "engine",       title: "Engine Bay",         icon: Camera },
  { id: "undercarriage",title: "Undercarriage",      icon: Camera },
  { id: "tires",        title: "Tire Tread",         icon: Gauge },
  { id: "brakes",       title: "Brakes",             icon: Wrench },
  { id: "obd",          title: "OBD Scan",           icon: ClipboardCheck },
  { id: "exterior",     title: "Exterior",           icon: Eye },
  { id: "interior",     title: "Interior",           icon: Eye },
  { id: "mechanical",   title: "Mechanical",         icon: Wrench },
  { id: "testdrive",    title: "Test Drive",         icon: Car },
  { id: "concerns",     title: "Final Notes",        icon: AlertCircle },
  { id: "review",       title: "Review & Submit",    icon: CheckCircle2 },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function isStepComplete(stepId: StepId, form: FormData): boolean {
  switch (stepId) {
    case "confirm":        return true;
    case "vin":           return form.vin_photo_url.trim().length > 0;
    case "odometer":      return form.odometer_photo_url.trim().length > 0;
    case "engine":        return form.under_hood_photo_url.trim().length > 0;
    case "undercarriage": return form.undercarriage_photo_url.trim().length > 0;
    case "tires":         return true; // optional numeric
    case "brakes":        return true; // optional
    case "obd":           return true; // optional
    case "exterior":      return form.cosmetic_exterior.trim().length > 0;
    case "interior":      return form.interior_condition.trim().length > 0;
    case "mechanical":    return form.mechanical_issues.trim().length > 0;
    case "testdrive":     return form.test_drive_notes.trim().length > 0;
    case "concerns":      return form.immediate_concerns.trim().length > 0;
    case "review":        return false;
    default:              return false;
  }
}

const REQUIRED_STEP_IDS: StepId[] = [
  "vin", "odometer", "engine", "undercarriage",
  "exterior", "interior", "mechanical", "testdrive", "concerns",
];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RideCheckerSubmitPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.assignmentId as string;
  const { toast } = useToast();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assignment, setAssignment] = useState<AssignmentDetails | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [scanCodeInput, setScanCodeInput] = useState("");
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const draftKey = `inspection_draft_${assignmentId}`;

  // ── Load auth + assignment + draft ────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!profile || !["ridechecker_active", "owner"].includes(profile.role)) {
        router.push("/auth/login"); return;
      }

      try {
        const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/detail`);
        if (res.ok) {
          const data = await res.json();
          if (data.assignment && data.order) {
            setAssignment({
              id:                  data.assignment.id,
              order_id:            data.assignment.order_id,
              status:              data.assignment.status,
              vehicle_year:        data.order.vehicle_year,
              vehicle_make:        data.order.vehicle_make,
              vehicle_model:       data.order.vehicle_model,
              vehicle_trim:        data.order.vehicle_trim,
              vehicle_location:    data.order.vehicle_location,
              inspection_address:  data.order.inspection_address,
              scheduled_date:      data.order.scheduled_date,
              scheduled_time:      data.order.scheduled_time,
              special_instructions:data.order.special_instructions,
            });
          }
        }
      } catch {}

      // Restore draft
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          setForm((prev) => ({ ...prev, ...parsed.form }));
          if (typeof parsed.step === "number") setCurrentStep(parsed.step);
        }
      } catch {}

      setLoading(false);
    }
    load();
  }, [assignmentId]);

  // ── Autosave draft ────────────────────────────────────────────────────────
  const saveDraft = useCallback((f: FormData, step: number) => {
    try { localStorage.setItem(draftKey, JSON.stringify({ form: f, step })); }
    catch {}
  }, [draftKey]);

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      saveDraft(next, currentStep);
      return next;
    });
  };

  const addScanCode = () => {
    const code = scanCodeInput.trim().toUpperCase();
    if (code && !form.scan_codes.includes(code)) {
      setForm((prev) => {
        const next = { ...prev, scan_codes: [...prev.scan_codes, code] };
        saveDraft(next, currentStep);
        return next;
      });
      setScanCodeInput("");
    }
  };

  const removeScanCode = (code: string) => {
    setForm((prev) => {
      const next = { ...prev, scan_codes: prev.scan_codes.filter((c) => c !== code) };
      saveDraft(next, currentStep);
      return next;
    });
  };

  const addExtraPhoto = () => {
    setForm((prev) => {
      const next = { ...prev, extra_photos: [...prev.extra_photos, ""] };
      saveDraft(next, currentStep);
      return next;
    });
  };

  const updateExtraPhoto = (index: number, value: string) => {
    setForm((prev) => {
      const updated = [...prev.extra_photos];
      updated[index] = value;
      const next = { ...prev, extra_photos: updated };
      saveDraft(next, currentStep);
      return next;
    });
  };

  const removeExtraPhoto = (index: number) => {
    setForm((prev) => {
      const next = { ...prev, extra_photos: prev.extra_photos.filter((_, i) => i !== index) };
      saveDraft(next, currentStep);
      return next;
    });
  };

  const goToStep = (index: number) => {
    saveDraft(form, index);
    setCurrentStep(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canProceed = (): boolean => {
    const step = STEPS[currentStep];
    if (step.id === "review") return true;
    return !REQUIRED_STEP_IDS.includes(step.id as StepId) || isStepComplete(step.id as StepId, form);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const missing = REQUIRED_STEP_IDS.filter((sid) => !isStepComplete(sid, form));
    if (missing.length > 0) {
      const labels = missing.map((sid) => STEPS.find((s) => s.id === sid)?.title).join(", ");
      toast({ title: `Still missing: ${labels}`, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        vin_photo_url:        form.vin_photo_url.trim(),
        odometer_photo_url:   form.odometer_photo_url.trim(),
        under_hood_photo_url: form.under_hood_photo_url.trim(),
        undercarriage_photo_url: form.undercarriage_photo_url.trim(),
        cosmetic_exterior:    form.cosmetic_exterior.trim(),
        interior_condition:   form.interior_condition.trim(),
        mechanical_issues:    form.mechanical_issues.trim(),
        test_drive_notes:     form.test_drive_notes.trim(),
        immediate_concerns:   form.immediate_concerns.trim(),
      };

      if (form.tire_tread_mm_front_left)  payload.tire_tread_mm_front_left  = Number(form.tire_tread_mm_front_left);
      if (form.tire_tread_mm_front_right) payload.tire_tread_mm_front_right = Number(form.tire_tread_mm_front_right);
      if (form.tire_tread_mm_rear_left)   payload.tire_tread_mm_rear_left   = Number(form.tire_tread_mm_rear_left);
      if (form.tire_tread_mm_rear_right)  payload.tire_tread_mm_rear_right  = Number(form.tire_tread_mm_rear_right);
      if (form.brake_condition)  payload.brake_condition = form.brake_condition;
      if (form.scan_codes.length > 0)     payload.scan_codes = form.scan_codes;
      if (form.audio_note_url.trim())     payload.audio_note_url = form.audio_note_url.trim();

      const filtered = form.extra_photos.filter((p) => p.trim().length > 0);
      if (filtered.length > 0) payload.extra_photos = filtered;

      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        try { localStorage.removeItem(draftKey); } catch {}
        toast({ title: "Inspection submitted! Great work." });
        router.push("/ridechecker/dashboard");
      } else {
        const data = await res.json();
        toast({ title: data.error || "Failed to submit", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to submit", variant: "destructive" });
    }
    setSubmitting(false);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const vehicleLabel = [assignment?.vehicle_year, assignment?.vehicle_make, assignment?.vehicle_model, assignment?.vehicle_trim]
    .filter(Boolean).join(" ");
  const locationStr = assignment?.inspection_address || assignment?.vehicle_location || "";
  const mapsUrl = locationStr
    ? `https://maps.google.com/maps?daddr=${encodeURIComponent(locationStr)}&saddr=My+Location`
    : null;

  const totalRequired = REQUIRED_STEP_IDS.length;
  const completedRequired = REQUIRED_STEP_IDS.filter((sid) => isStepComplete(sid, form)).length;
  const allDone = completedRequired === totalRequired;
  const progressPct = Math.round((completedRequired / totalRequired) * 100);

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const stepComplete = isStepComplete(step.id as StepId, form);
  const isRequired = REQUIRED_STEP_IDS.includes(step.id as StepId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Sticky Top Bar ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background border-b shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={`/ridechecker/jobs/${assignmentId}`}>
            <button className="p-1 -ml-1 rounded-md text-muted-foreground hover:text-foreground" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{vehicleLabel || "Inspection"}</p>
            <p className="text-sm font-semibold leading-tight">
              Step {currentStep + 1} of {STEPS.length} — {step.title}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {allDone ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <span className="text-xs text-muted-foreground">{completedRequired}/{totalRequired}</span>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-1 bg-[#22774F] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Step Content ────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-28">

        {/* ── STEP: Confirm Vehicle ──────────────────────────────────── */}
        {step.id === "confirm" && (
          <div className="space-y-4">
            <div className="text-center space-y-1 pt-2">
              <div className="inline-flex h-14 w-14 rounded-full bg-[#22774F]/10 items-center justify-center mb-2">
                <Car className="h-7 w-7 text-[#22774F]" />
              </div>
              <h2 className="text-xl font-bold">You're at the right car?</h2>
              <p className="text-muted-foreground text-sm">Confirm the vehicle details below match what's in front of you before starting.</p>
            </div>
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Vehicle</p>
                <p className="font-semibold text-lg" data-testid="text-vehicle-label">{vehicleLabel || "—"}</p>
              </div>
              {locationStr && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Inspection Location</p>
                  <p className="text-sm" data-testid="text-location">{locationStr}</p>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-white bg-[#22774F] hover:bg-[#1a5e3e] px-3 py-2 rounded-lg"
                      data-testid="link-directions"
                    >
                      <Navigation className="h-4 w-4" />
                      Get Directions
                    </a>
                  )}
                </div>
              )}
              {(assignment?.scheduled_date || assignment?.scheduled_time) && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Scheduled</p>
                  <p className="text-sm">{assignment.scheduled_date} {assignment.scheduled_time ? `at ${assignment.scheduled_time}` : ""}</p>
                </div>
              )}
              {assignment?.special_instructions && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Notes from Ops</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">{assignment.special_instructions}</p>
                </div>
              )}
            </div>
            <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Before you begin:</p>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>Make sure your phone has a good signal</li>
                <li>Photos will upload automatically</li>
                <li>Your progress is saved if you close this page</li>
                <li>Take clear, well-lit photos</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── STEP: VIN Photo ───────────────────────────────────────── */}
        {step.id === "vin" && (
          <div className="space-y-4">
            <StepHeader
              icon={<Camera className="h-7 w-7 text-[#22774F]" />}
              title="VIN Photo"
              description="Photograph the VIN sticker on the driver's door jamb. All 17 characters must be clearly legible."
            />
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Where to find it</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Open the driver's door. The VIN sticker is on the door frame (the part of the car the door latches into), usually near the top.</p>
            </div>
            <PhotoUpload
              label="VIN Plate"
              hint="All 17 characters must be legible. Avoid glare."
              fieldKey="vin_photo"
              value={form.vin_photo_url}
              onChange={(url) => updateField("vin_photo_url", url)}
              assignmentId={assignmentId}
              required
            />
          </div>
        )}

        {/* ── STEP: Odometer ────────────────────────────────────────── */}
        {step.id === "odometer" && (
          <div className="space-y-4">
            <StepHeader
              icon={<Gauge className="h-7 w-7 text-[#22774F]" />}
              title="Odometer Reading"
              description="Photograph the dashboard with the ignition on so the odometer is clearly visible."
            />
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Pro tip</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Turn the key to the "on" position (engine doesn't need to be running). Capture the full gauge cluster so mileage and warning lights are both visible.</p>
            </div>
            <PhotoUpload
              label="Odometer"
              hint="Dashboard display with ignition on. Show full gauge cluster."
              fieldKey="odometer_photo"
              value={form.odometer_photo_url}
              onChange={(url) => updateField("odometer_photo_url", url)}
              assignmentId={assignmentId}
              required
            />
          </div>
        )}

        {/* ── STEP: Engine Bay ──────────────────────────────────────── */}
        {step.id === "engine" && (
          <div className="space-y-4">
            <StepHeader
              icon={<Camera className="h-7 w-7 text-[#22774F]" />}
              title="Engine Bay"
              description="Open the hood fully and take an overhead shot showing the entire engine and all fluid reservoirs."
            />
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">What to capture</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Stand above the open hood. Include oil cap, coolant reservoir, brake fluid, and battery. Look for leaks, corrosion, or aftermarket modifications.</p>
            </div>
            <PhotoUpload
              label="Engine Bay"
              hint="Hood fully open. Overhead shot showing engine and all fluid reservoirs."
              fieldKey="under_hood_photo"
              value={form.under_hood_photo_url}
              onChange={(url) => updateField("under_hood_photo_url", url)}
              assignmentId={assignmentId}
              required
            />
          </div>
        )}

        {/* ── STEP: Undercarriage ───────────────────────────────────── */}
        {step.id === "undercarriage" && (
          <div className="space-y-4">
            <StepHeader
              icon={<Camera className="h-7 w-7 text-[#22774F]" />}
              title="Undercarriage"
              description="Low-angle shot from the front showing the frame, suspension, and exhaust."
            />
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">What to look for</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Crouch at the front bumper and shoot under the car. Look for rust on the frame, leaking fluids, damaged exhaust, or worn suspension components. Document anything that looks off.</p>
            </div>
            <PhotoUpload
              label="Undercarriage"
              hint="Low-angle from front. Show frame, suspension, exhaust. Note rust or leaks."
              fieldKey="undercarriage_photo"
              value={form.undercarriage_photo_url}
              onChange={(url) => updateField("undercarriage_photo_url", url)}
              assignmentId={assignmentId}
              required
            />
          </div>
        )}

        {/* ── STEP: Tires ───────────────────────────────────────────── */}
        {step.id === "tires" && (
          <div className="space-y-4">
            <StepHeader
              icon={<Gauge className="h-7 w-7 text-[#22774F]" />}
              title="Tire Tread Depth"
              description="Measure each tire's tread depth with a gauge or coin. Optional but adds significant value to the report."
            />
            <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-3 space-y-1">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Quick reference</p>
              <div className="flex gap-4 text-xs text-blue-700 dark:text-blue-400">
                <span>🟢 6mm+ New</span>
                <span>🟡 3–5mm Good</span>
                <span>🟠 2mm Fair</span>
                <span>🔴 &lt;1.6mm Replace</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "tire_tread_mm_front_left" as keyof FormData,  label: "Front Left",  id: "tire_fl" },
                { key: "tire_tread_mm_front_right" as keyof FormData, label: "Front Right", id: "tire_fr" },
                { key: "tire_tread_mm_rear_left" as keyof FormData,   label: "Rear Left",   id: "tire_rl" },
                { key: "tire_tread_mm_rear_right" as keyof FormData,  label: "Rear Right",  id: "tire_rr" },
              ].map(({ key, label, id }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={id} className="text-sm">{label}</Label>
                  <Input
                    id={id}
                    type="number"
                    step="0.1"
                    min="0"
                    max="15"
                    placeholder="mm"
                    value={form[key] as string}
                    onChange={(e) => updateField(key, e.target.value)}
                    className="text-lg h-12"
                    data-testid={`input-tire-${id}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">Skip if you don't have a gauge — tap Next to continue.</p>
          </div>
        )}

        {/* ── STEP: Brakes ──────────────────────────────────────────── */}
        {step.id === "brakes" && (
          <div className="space-y-4">
            <StepHeader
              icon={<Wrench className="h-7 w-7 text-[#22774F]" />}
              title="Brake Condition"
              description="Assess the brakes during the test drive or by looking through the wheel spokes."
            />
            <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-3 space-y-1.5">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300">How to assess</p>
              <div className="text-xs text-blue-700 dark:text-blue-400 space-y-0.5">
                <p><strong>Good</strong> — Plenty of pad life, no noise, confident stopping</p>
                <p><strong>Fair</strong> — Visible wear, may need replacement soon</p>
                <p><strong>Poor</strong> — Squealing, grinding, vibration, or &lt;2mm pad thickness</p>
              </div>
            </div>
            <Select value={form.brake_condition} onValueChange={(val) => updateField("brake_condition", val)}>
              <SelectTrigger className="h-12 text-base" data-testid="select-brake-condition">
                <SelectValue placeholder="Select brake condition…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">🟢 Good — Plenty of pad life</SelectItem>
                <SelectItem value="fair">🟡 Fair — Noticeable wear</SelectItem>
                <SelectItem value="poor">🔴 Poor — Squealing, grinding, or worn</SelectItem>
                <SelectItem value="unknown">⚪ Unknown / Couldn't inspect</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground text-center">Optional — tap Next to skip.</p>
          </div>
        )}

        {/* ── STEP: OBD Scan ────────────────────────────────────────── */}
        {step.id === "obd" && (
          <div className="space-y-4">
            <StepHeader
              icon={<ClipboardCheck className="h-7 w-7 text-[#22774F]" />}
              title="OBD-II Scan Codes"
              description="Connect your scan tool to the OBD-II port (under the dash, driver's side) and record any codes."
            />
            <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-3">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Important</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Include ALL codes shown — active and stored/cleared. If no codes are found, leave this empty. Don't guess.</p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. P0301"
                value={scanCodeInput}
                onChange={(e) => setScanCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addScanCode(); } }}
                className="flex-1 uppercase h-12 text-base"
                data-testid="input-scan-code"
              />
              <Button variant="outline" onClick={addScanCode} className="h-12 px-4" data-testid="button-add-scan-code">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {form.scan_codes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {form.scan_codes.map((code) => (
                  <Badge key={code} variant="secondary" className="gap-1 text-sm py-1.5 px-3" data-testid={`badge-scan-code-${code}`}>
                    {code}
                    <button onClick={() => removeScanCode(code)} className="ml-1" data-testid={`button-remove-scan-code-${code}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground py-2">No codes added — clean scan is fine.</p>
            )}
          </div>
        )}

        {/* ── STEP: Exterior ────────────────────────────────────────── */}
        {step.id === "exterior" && (
          <div className="space-y-4">
            <StepHeader
              icon={<Eye className="h-7 w-7 text-[#22774F]" />}
              title="Cosmetic Exterior"
              description="Walk around the vehicle and document all cosmetic findings. Be specific — these notes go directly into the buyer's report."
            />
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Look for</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Dents, scratches, paint fade or chips, rust, cracked glass, panel misalignment, aftermarket modifications, accident evidence.</p>
            </div>
            <Textarea
              placeholder="e.g. Small dent on rear passenger door, minor scratches on front bumper, paint fading on hood, no visible rust. All glass intact."
              value={form.cosmetic_exterior}
              onChange={(e) => updateField("cosmetic_exterior", e.target.value)}
              rows={5}
              className="resize-none text-base"
              data-testid="textarea-cosmetic-exterior"
            />
            <CompletionPill done={form.cosmetic_exterior.trim().length > 0} />
          </div>
        )}

        {/* ── STEP: Interior ────────────────────────────────────────── */}
        {step.id === "interior" && (
          <div className="space-y-4">
            <StepHeader
              icon={<Eye className="h-7 w-7 text-[#22774F]" />}
              title="Interior Condition"
              description="Inspect the entire cabin and document what you find."
            />
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Check these</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Seats (wear, stains, tears), carpet, headliner, dash/trim cracks, all controls (AC, windows, locks, radio), odors, any warning lights on the cluster.</p>
            </div>
            <Textarea
              placeholder="e.g. Seats clean with minor wear on driver's side, no stains, AC works, all power windows functional, slight musty odor, no cracks on dash."
              value={form.interior_condition}
              onChange={(e) => updateField("interior_condition", e.target.value)}
              rows={5}
              className="resize-none text-base"
              data-testid="textarea-interior-condition"
            />
            <CompletionPill done={form.interior_condition.trim().length > 0} />
          </div>
        )}

        {/* ── STEP: Mechanical ──────────────────────────────────────── */}
        {step.id === "mechanical" && (
          <div className="space-y-4">
            <StepHeader
              icon={<Wrench className="h-7 w-7 text-[#22774F]" />}
              title="Mechanical Issues"
              description="Document any mechanical problems found during your inspection — engine bay, underneath, and on the drive."
            />
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">What to include</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Oil leaks, coolant issues, unusual engine sounds, suspension clunks, transmission hesitation, exhaust smoke or smell, AC/heater performance.</p>
            </div>
            <Textarea
              placeholder="e.g. Minor oil seep around valve cover (not dripping), slight clunk from front suspension over bumps, engine starts and runs smoothly, no smoke."
              value={form.mechanical_issues}
              onChange={(e) => updateField("mechanical_issues", e.target.value)}
              rows={5}
              className="resize-none text-base"
              data-testid="textarea-mechanical-issues"
            />
            <CompletionPill done={form.mechanical_issues.trim().length > 0} />
          </div>
        )}

        {/* ── STEP: Test Drive ──────────────────────────────────────── */}
        {step.id === "testdrive" && (
          <div className="space-y-4">
            <StepHeader
              icon={<Car className="h-7 w-7 text-[#22774F]" />}
              title="Test Drive Notes"
              description="If a test drive was possible, document how the vehicle performed. If not, note why."
            />
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Cover these points</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Engine acceleration, transmission shift quality, steering response, brake feel, any vibrations or pulling, dash warning lights during drive, sounds at different speeds.</p>
            </div>
            <Textarea
              placeholder="e.g. Test drove approx. 3 miles. Engine accelerates smoothly, transmission shifts cleanly through all gears, brakes feel firm, slight pull to the right at highway speed, no warning lights during drive."
              value={form.test_drive_notes}
              onChange={(e) => updateField("test_drive_notes", e.target.value)}
              rows={5}
              className="resize-none text-base"
              data-testid="textarea-test-drive-notes"
            />
            <CompletionPill done={form.test_drive_notes.trim().length > 0} />
          </div>
        )}

        {/* ── STEP: Concerns ────────────────────────────────────────── */}
        {step.id === "concerns" && (
          <div className="space-y-4">
            <StepHeader
              icon={<AlertCircle className="h-7 w-7 text-[#22774F]" />}
              title="Immediate Concerns"
              description="List anything a buyer MUST know before purchasing. Safety issues, major faults, or deceptive listings."
            />
            <div className="rounded-xl border bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 p-3">
              <p className="text-xs font-medium text-red-700 dark:text-red-400">Examples of immediate concerns</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Frame damage, airbag warning, active oil leak, brake grinding, salvage title not disclosed, odometer rollback signs, flood damage indicators.</p>
            </div>
            <Textarea
              placeholder="e.g. No immediate safety concerns found. OR: Airbag warning light on, suspect deployed and reset — buyer should verify before purchase."
              value={form.immediate_concerns}
              onChange={(e) => updateField("immediate_concerns", e.target.value)}
              rows={4}
              className="resize-none text-base"
              data-testid="textarea-immediate-concerns"
            />
            <CompletionPill done={form.immediate_concerns.trim().length > 0} />

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Extra Photos <span className="text-muted-foreground font-normal">(optional)</span></p>
              <p className="text-xs text-muted-foreground">Add any additional photos that support your findings.</p>
              {form.extra_photos.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Photo URL"
                    value={url}
                    onChange={(e) => updateExtraPhoto(i, e.target.value)}
                    className="flex-1"
                    data-testid={`input-extra-photo-${i}`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeExtraPhoto(i)} data-testid={`button-remove-extra-photo-${i}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addExtraPhoto} className="w-full" data-testid="button-add-extra-photo">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Photo URL
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: Review & Submit ─────────────────────────────────── */}
        {step.id === "review" && (
          <div className="space-y-4">
            <div className="text-center space-y-1 pt-2">
              <div className={`inline-flex h-14 w-14 rounded-full items-center justify-center mb-2 ${allDone ? "bg-green-100 dark:bg-green-900/40" : "bg-red-100 dark:bg-red-900/40"}`}>
                {allDone
                  ? <CheckCircle2 className="h-7 w-7 text-green-600" />
                  : <AlertCircle className="h-7 w-7 text-red-500" />
                }
              </div>
              <h2 className="text-xl font-bold">{allDone ? "Ready to Submit" : "Almost There"}</h2>
              <p className="text-muted-foreground text-sm">
                {allDone ? "All required sections are complete. Review below and submit." : "Some required sections are missing."}
              </p>
            </div>

            {/* Checklist summary */}
            <div className="rounded-xl border bg-card divide-y overflow-hidden">
              {STEPS.filter((s) => s.id !== "confirm" && s.id !== "review").map((s, i) => {
                const done = isStepComplete(s.id as StepId, form);
                const required = REQUIRED_STEP_IDS.includes(s.id as StepId);
                const stepIndex = STEPS.findIndex((x) => x.id === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => goToStep(stepIndex)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left"
                    data-testid={`button-review-step-${s.id}`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : required ? (
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                    )}
                    <span className={`flex-1 text-sm ${done ? "" : required ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                      {s.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {done ? "Done" : required ? "Required" : "Optional"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>

            {!allDone && (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  {totalRequired - completedRequired} required section{totalRequired - completedRequired !== 1 ? "s" : ""} still needed
                </p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">Tap any red item above to go back and complete it.</p>
              </div>
            )}

            <Button
              className="w-full h-14 text-base font-semibold bg-[#22774F] hover:bg-[#1a5e3e] text-white"
              disabled={!allDone || submitting}
              onClick={handleSubmit}
              data-testid="button-submit-inspection"
            >
              {submitting ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Submitting…</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 mr-2" /> Submit Inspection</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ── Sticky Bottom Nav ───────────────────────────────────────────── */}
      {step.id !== "review" && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-background border-t px-4 py-3 flex gap-3">
          {currentStep > 0 && (
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={() => goToStep(currentStep - 1)}
              data-testid="button-prev-step"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <Button
            className={`h-12 font-semibold ${currentStep > 0 ? "flex-[2]" : "w-full"} ${
              isRequired && !stepComplete
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-[#22774F] hover:bg-[#1a5e3e] text-white"
            }`}
            disabled={isRequired && !stepComplete}
            onClick={() => {
              if (currentStep < STEPS.length - 1) goToStep(currentStep + 1);
            }}
            data-testid="button-next-step"
          >
            {isRequired && !stepComplete ? (
              "Complete this step first"
            ) : currentStep === STEPS.length - 2 ? (
              <><ClipboardCheck className="h-4 w-4 mr-2" />Review & Submit</>
            ) : (
              <>Next <ArrowRight className="h-4 w-4 ml-2" /></>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function StepHeader({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center space-y-1 pt-2">
      <div className="inline-flex h-14 w-14 rounded-full bg-[#22774F]/10 items-center justify-center mb-2">
        {icon}
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-muted-foreground text-sm px-2">{description}</p>
    </div>
  );
}

function CompletionPill({ done }: { done: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${done ? "text-green-600" : "text-muted-foreground"}`}>
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-current" />}
      {done ? "Saved" : "Required — type your findings above"}
    </div>
  );
}
