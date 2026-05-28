"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  Camera,
  MessageSquareOff,
  Wrench,
  Eye,
  BookOpen,
  Download,
  Globe,
  FileText,
  Star,
  Shield,
  ClipboardList,
  Gauge,
  Navigation,
  Users,
  Layers,
} from "lucide-react";

// ── Guide sections ──────────────────────────────────────────────────────────

const GUIDE_STORAGE_KEY = "rc_guide_section_progress";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const GUIDE_SECTIONS: GuideSection[] = [
  { id: "getting-started",    title: "Getting Started",          icon: <Star className="h-4 w-4 text-primary" /> },
  { id: "dashboard-basics",   title: "Dashboard Basics",         icon: <Layers className="h-4 w-4 text-primary" /> },
  { id: "accepting-jobs",     title: "Accepting Jobs",           icon: <ClipboardList className="h-4 w-4 text-primary" /> },
  { id: "inspection-wizard",  title: "Guided Inspection Wizard", icon: <Navigation className="h-4 w-4 text-primary" /> },
  { id: "photo-standards",    title: "Photo Standards",          icon: <Camera className="h-4 w-4 text-primary" /> },
  { id: "obd-scan",           title: "OBD-II Scan",              icon: <Gauge className="h-4 w-4 text-primary" /> },
  { id: "seller-conduct",     title: "Seller Conduct",           icon: <Users className="h-4 w-4 text-primary" /> },
  { id: "safety-escalation",  title: "Safety & Escalation",      icon: <Shield className="h-4 w-4 text-primary" /> },
  { id: "ridechecker-score",  title: "RideCheck Score System",   icon: <Star className="h-4 w-4 text-primary" /> },
  { id: "certification-path", title: "Certification Path",       icon: <GraduationCap className="h-4 w-4 text-primary" /> },
];

function loadGuideProgress(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(GUIDE_STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function saveGuideProgress(progress: Record<string, boolean>) {
  try { localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(progress)); } catch { /* noop */ }
}

// ── GuideSection component ─────────────────────────────────────────────────

function GuideSectionBlock({
  section,
  isRead,
  onToggleRead,
  children,
}: {
  section: GuideSection;
  isRead: boolean;
  onToggleRead: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${isRead ? "border-emerald-200 dark:border-emerald-800" : "border-border"}`}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
        data-testid={`guide-section-${section.id}`}
      >
        <span className="flex items-center gap-2 font-medium text-sm">
          {isRead
            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            : <span className="flex-shrink-0">{section.icon}</span>
          }
          {section.title}
        </span>
        <span className="flex items-center gap-2">
          {isRead && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs px-1.5 py-0">Read</Badge>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>
      {open && (
        <div className="border-t">
          <div className="px-4 py-4 text-sm space-y-3">{children}</div>
          <div className="px-4 pb-4 border-t pt-3">
            <button
              type="button"
              onClick={onToggleRead}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
                isRead
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
              }`}
              data-testid={`button-mark-read-${section.id}`}
            >
              {isRead ? <><CheckCircle2 className="h-3.5 w-3.5" /> Marked as read</> : <><BookOpen className="h-3.5 w-3.5" /> Mark section as read</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quiz questions (NO answers here — answers are server-side only) ────────

interface Question {
  id: string;
  text: string;
  options: { letter: string; text: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "Which four layers make up the RideCheck Inspection Mindset?",
    options: [
      { letter: "a", text: "Visual, Mechanical, Historical, Electrical" },
      { letter: "b", text: "Digital, Functional, Integrity, Structural" },
      { letter: "c", text: "Interior, Exterior, Engine, Performance" },
      { letter: "d", text: "Safety, Comfort, Reliability, Cost" },
    ],
  },
  {
    id: "q2",
    text: "When testing vehicle functional systems, which items should you verify?",
    options: [
      { letter: "a", text: "Engine start and brake pedal only" },
      { letter: "b", text: "Items the seller specifically points out" },
      { letter: "c", text: "All buttons, HVAC, lights, windows, and accessible controls" },
      { letter: "d", text: "Only safety systems required by state law" },
    ],
  },
  {
    id: "q3",
    text: "What is the correct photo documentation standard for each finding?",
    options: [
      { letter: "a", text: "One wide-angle shot per panel is sufficient" },
      { letter: "b", text: "Only photograph defects you discover" },
      { letter: "c", text: "Both a close-up detail shot and a wide context shot for each finding" },
      { letter: "d", text: "Photograph the exterior only; interior is optional" },
    ],
  },
  {
    id: "q4",
    text: "Which of the following follows RideCheck's communication rules?",
    options: [
      { letter: "a", text: '"Based on what I see, I\'d pass on this one."' },
      { letter: "b", text: '"This looks like a great deal to me."' },
      { letter: "c", text: '"The OBD scan returned two active fault codes: DTC P0420 and P0171."' },
      { letter: "d", text: '"I\'d recommend skipping this one given the rust."' },
    ],
  },
  {
    id: "q5",
    text: "Which of the following qualifies as a basic red flag that must be documented?",
    options: [
      { letter: "a", text: "Tires that are less than two years old" },
      { letter: "b", text: "Factory-original paint throughout the vehicle" },
      { letter: "c", text: "Surface frame rust, a mileage inconsistency, or active OBD fault codes" },
      { letter: "d", text: "A slightly dirty engine bay with no visible leaks or damage" },
    ],
  },
];

// ── Existing SIP-4 content section toggle ─────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
        data-testid={`section-toggle-${title.replace(/\s+/g, "-").toLowerCase()}`}
      >
        <span className="flex items-center gap-2 font-medium text-sm">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-4 py-4 text-sm space-y-2 border-t">{children}</div>
      )}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

type PageState = "loading" | "unauthorized" | "ready";
type QuizState = "idle" | "submitting" | "passed" | "failed";

// ── Main Page ──────────────────────────────────────────────────────────────

export default function RideCheckerTrainingPage() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [profile, setProfile] = useState<any>(null);
  const [existingResult, setExistingResult] = useState<any>(null);
  const [alreadyCertified, setAlreadyCertified] = useState(false);

  // Guide progress state
  const [guideProgress, setGuideProgress] = useState<Record<string, boolean>>({});
  const [guideCertified, setGuideCertified] = useState(false);
  const [guideCompletedAt, setGuideCompletedAt] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizState, setQuizState] = useState<QuizState>("idle");
  const [quizResult, setQuizResult] = useState<{
    passed: boolean;
    score: number;
    correct: number;
    total: number;
    attempts: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login?redirect=/ridechecker/training");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("role, is_active, full_name, training_sip4_completed")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!prof) {
        setPageState("unauthorized");
        return;
      }

      const allowed = ["ridechecker_active", "owner", "operations_lead"];
      if (!allowed.includes(prof.role)) {
        setPageState("unauthorized");
        return;
      }

      if (!prof.is_active && prof.role !== "owner" && prof.role !== "operations_lead") {
        setPageState("unauthorized");
        return;
      }

      setProfile(prof);
      setAlreadyCertified(prof.training_sip4_completed === true);

      // Load existing SIP-4 quiz result
      const statusRes = await fetch("/api/ridechecker/training/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.result) setExistingResult(statusData.result);
      }

      // Load guide progress from localStorage
      const savedProgress = loadGuideProgress();
      setGuideProgress(savedProgress);

      // Load guide certification from API
      const guideRes = await fetch("/api/ridechecker/training/guide-progress");
      if (guideRes.ok) {
        const guideData = await guideRes.json();
        setGuideCertified(guideData.completed === true);
        setGuideCompletedAt(guideData.completed_at ?? null);
      }

      setPageState("ready");
    }
    load();
  }, []);

  const sectionsRead = Object.values(guideProgress).filter(Boolean).length;
  const totalSections = GUIDE_SECTIONS.length;
  const guideProgressPct = Math.round((sectionsRead / totalSections) * 100);
  const allSectionsRead = sectionsRead === totalSections;
  const allAnswered = QUESTIONS.every((q) => !!answers[q.id]);

  const toggleGuideSection = (sectionId: string) => {
    setGuideProgress((prev) => {
      const updated = { ...prev, [sectionId]: !prev[sectionId] };
      saveGuideProgress(updated);
      return updated;
    });
  };

  const markGuideComplete = async () => {
    setMarkingComplete(true);
    try {
      const res = await fetch("/api/ridechecker/training/guide-progress", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setGuideCertified(true);
      setGuideCompletedAt(data.completed_at ?? null);
      toast({ title: "Guide marked as completed! Great work." });
    } catch {
      toast({ title: "Could not save completion. Try again.", variant: "destructive" });
    } finally {
      setMarkingComplete(false);
    }
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const ReactLib = await import("react");
      const { TrainingGuidePDF } = await import("@/lib/training/training-guide-pdf");
      const blob = await pdf(ReactLib.default.createElement(TrainingGuidePDF)).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "RideChecker-Training-Guide.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "PDF generation failed. Please try again.", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!allAnswered) {
      toast({ title: "Please answer all questions before submitting.", variant: "destructive" });
      return;
    }
    setQuizState("submitting");
    try {
      const res = await fetch("/api/ridechecker/training/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      setQuizResult(data);
      setQuizState(data.passed ? "passed" : "failed");
      if (data.passed) setAlreadyCertified(true);
    } catch (err: any) {
      toast({ title: err.message || "Failed to submit quiz.", variant: "destructive" });
      setQuizState("idle");
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setQuizState("idle");
    setQuizResult(null);
  };

  // ── Loading / Unauthorized ───────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (pageState === "unauthorized") {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-sm w-full text-center">
            <CardContent className="pt-8 pb-6">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="font-semibold">Access Denied</p>
              <p className="text-sm text-muted-foreground mt-1">
                Training is available to active RideCheckers only.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">

        {/* ── Page Header ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-training-title">
              RideChecker Training Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Operations guide · Certification · Field reference
            </p>
          </div>
        </div>

        {/* ── Status Row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-xl border p-3 ${alreadyCertified ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-card border-border"}`}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">SIP-4 Certification</p>
            {alreadyCertified ? (
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Certified</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Not yet certified</span>
              </div>
            )}
          </div>
          <div className={`rounded-xl border p-3 ${guideCertified ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-card border-border"}`}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Operations Guide</p>
            {guideCertified ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Completed</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{guideProgressPct}% read</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Operations & Training Guide ───────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold">Operations & Training Guide</h2>
            </div>
            <span className="text-xs text-muted-foreground">{sectionsRead}/{totalSections} sections</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-2 bg-[#22774F] rounded-full transition-all duration-500"
              style={{ width: `${guideProgressPct}%` }}
              data-testid="bar-guide-progress"
            />
          </div>

          {/* Guide sections */}
          <div className="space-y-2">

            {/* 1 — Getting Started */}
            <GuideSectionBlock
              section={GUIDE_SECTIONS[0]}
              isRead={!!guideProgress["getting-started"]}
              onToggleRead={() => toggleGuideSection("getting-started")}
            >
              <p className="text-muted-foreground">Everything you need to bring and do before leaving for a job.</p>
              <div className="space-y-2">
                <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
                  <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Essential Equipment</p>
                  {["Smartphone (charged to 50%+)", "OBD-II Bluetooth scanner", "Portable power bank", "Flashlight", "Tire tread depth gauge", "Nitrile gloves + microfiber cloth"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Pre-job checklist</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Phone charged · OBD scanner packed · address confirmed · data connection working · at least 90 min buffer before scheduled time.</p>
                </div>
              </div>
            </GuideSectionBlock>

            {/* 2 — Dashboard Basics */}
            <GuideSectionBlock
              section={GUIDE_SECTIONS[1]}
              isRead={!!guideProgress["dashboard-basics"]}
              onToggleRead={() => toggleGuideSection("dashboard-basics")}
            >
              <p className="text-muted-foreground">Your dashboard has 5 tabs — know what each one is for.</p>
              <div className="space-y-2">
                {[
                  { tab: "Overview", desc: "Stats at a glance + Action Required banner at the very top. If a job offer is waiting, it shows here with a live countdown timer. Always check this first." },
                  { tab: "My Jobs", desc: "All assignments grouped: Action Required (pending offers with countdown), Active (accepted/in-progress), Past (completed history)." },
                  { tab: "Pay & Payouts", desc: "Full earnings history, per-job breakdown, bonus details (on-time, quality, streak), payout status: Pending → Approved → Paid." },
                  { tab: "Availability", desc: "14-day calendar. Set your available time windows here — Ops only offers you jobs during windows you've marked available. Update every Sunday." },
                  { tab: "Training", desc: "Certification status, guide reading progress, access to all training material and the quiz." },
                ].map(({ tab, desc }) => (
                  <div key={tab} className="bg-muted/40 rounded-lg p-3">
                    <p className="font-semibold text-xs mb-0.5">{tab}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </GuideSectionBlock>

            {/* 3 — Accepting Jobs */}
            <GuideSectionBlock
              section={GUIDE_SECTIONS[2]}
              isRead={!!guideProgress["accepting-jobs"]}
              onToggleRead={() => toggleGuideSection("accepting-jobs")}
            >
              <p className="text-muted-foreground">Job offers have a timer. Fast decisions matter.</p>
              <div className="space-y-2">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="font-semibold text-xs mb-1">The Offer Timer</p>
                  <p className="text-xs text-muted-foreground">New offers show a 15–30 min countdown at the top of your dashboard. First RideChecker to accept gets the job. Timer expiry = implicit decline.</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="font-semibold text-xs mb-1">Before Accepting — Confirm</p>
                  <div className="space-y-1 mt-1">
                    {["You can physically reach the location by the scheduled time", "Your OBD scanner is with you or will be before the job", "Your phone is charged or you have a charger"].map((item) => (
                      <div key={item} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Decline rules</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">5 declines in 30 days = warning. No-show after acceptance = most serious violation. Only accept what you will complete.</p>
                </div>
              </div>
            </GuideSectionBlock>

            {/* 4 — Inspection Wizard */}
            <GuideSectionBlock
              section={GUIDE_SECTIONS[3]}
              isRead={!!guideProgress["inspection-wizard"]}
              onToggleRead={() => toggleGuideSection("inspection-wizard")}
            >
              <p className="text-muted-foreground">16 steps that guide every inspection. The system tells you exactly what to do.</p>
              <div className="space-y-2">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="font-semibold text-xs mb-2">16 Steps in Order</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {[
                      "1. Confirm Vehicle", "2. VIN Photo", "3. Odometer", "4. Engine Bay",
                      "5. Undercarriage", "6. Tire Tread", "7. Brakes", "8. OBD Scan",
                      "9. Title & History", "10. Exterior", "11. Interior", "12. Mechanical",
                      "13. Test Drive", "14. Final Notes", "15. Road Test Module", "16. Review & Submit",
                    ].map((step) => (
                      <span key={step} className="text-xs text-muted-foreground">{step}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">9 Required sections (must complete before submitting)</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">VIN photo · Odometer · Engine Bay · Undercarriage · Exterior notes · Interior notes · Mechanical notes · Test Drive notes · Final Notes</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="font-semibold text-xs mb-0.5">Auto-save</p>
                  <p className="text-xs text-muted-foreground">Saves after every entry. If your phone dies mid-inspection, reopen the app and tap Resume — your work is preserved. No manual save needed.</p>
                </div>
              </div>
            </GuideSectionBlock>

            {/* 5 — Photo Standards */}
            <GuideSectionBlock
              section={GUIDE_SECTIONS[4]}
              isRead={!!guideProgress["photo-standards"]}
              onToggleRead={() => toggleGuideSection("photo-standards")}
            >
              <p className="text-muted-foreground">Photos are evidence. Know the standard for each required shot.</p>
              <div className="space-y-2">
                {[
                  { title: "VIN Photo", detail: "Driver door jamb (not dashboard). All 17 characters must be legible without zoom. Angle camera slightly to eliminate glare. Reject: any character obscured." },
                  { title: "Odometer", detail: "Ignition ON (key to second click — engine doesn't need to run). Full gauge cluster in frame, not just the number. Mileage AND any warning lights must both be visible." },
                  { title: "Engine Bay", detail: "Hood fully open. Stand above and shoot straight down. Show the entire compartment: oil cap, coolant reservoir, brake fluid, battery. All four corners in frame." },
                  { title: "Undercarriage", detail: "Flashlight on first, then position. Multiple angles: front, center (frame rails), rear (exhaust/muffler). Get low — use your mat. Dark = blurry = rejected by QA." },
                ].map(({ title, detail }) => (
                  <div key={title} className="bg-muted/40 rounded-lg p-3">
                    <p className="font-semibold text-xs mb-0.5">{title}</p>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                ))}
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Two-shot rule for findings</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">Every significant finding needs two photos: (1) close-up — fills the frame with the specific detail; (2) wide context — shows location and scale on the vehicle.</p>
                </div>
              </div>
            </GuideSectionBlock>

            {/* 6 — OBD-II Scan */}
            <GuideSectionBlock
              section={GUIDE_SECTIONS[5]}
              isRead={!!guideProgress["obd-scan"]}
              onToggleRead={() => toggleGuideSection("obd-scan")}
            >
              <p className="text-muted-foreground">The OBD port is the vehicle's data recorder. Always plug in.</p>
              <div className="space-y-2">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="font-semibold text-xs mb-1">How to perform the scan</p>
                  <div className="space-y-1">
                    {[
                      "Find the OBD-II port under the driver's side dashboard, near the steering column",
                      "Plug in your Bluetooth scanner and pair with your phone app",
                      "Run a full scan — record all DTC codes by code number (e.g., P0420) and description",
                      "Note the emissions readiness monitors status: Complete or Incomplete",
                      "Screenshot the results screen and upload if your app supports it",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
                        <span className="text-muted-foreground">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Incomplete monitors = flag it</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">If emissions monitors show "Incomplete," some checks haven't run — this can mean codes were recently cleared. Note it. It's a meaningful finding.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Seller refuses OBD access</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Document "seller declined OBD access" in notes. Continue with the rest of the inspection. This is NOT your fault and does NOT hurt your score.</p>
                </div>
              </div>
            </GuideSectionBlock>

            {/* 7 — Seller Conduct */}
            <GuideSectionBlock
              section={GUIDE_SECTIONS[6]}
              isRead={!!guideProgress["seller-conduct"]}
              onToggleRead={() => toggleGuideSection("seller-conduct")}
            >
              <p className="text-muted-foreground">You represent RideCheck. Be professional, neutral, and consistent at every job.</p>
              <div className="space-y-2">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="font-semibold text-xs mb-1">Introduction</p>
                  <p className="text-xs text-muted-foreground italic">"Hi, I'm [Your Name] from RideCheck — I'm here for the pre-purchase inspection."</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs font-semibold text-destructive mb-1.5">Never say</p>
                    <div className="space-y-1">
                      {['"I would buy this car."', '"This is a great deal."', '"Walk away — this has issues."', '"The price is too high."'].map((s) => (
                        <div key={s} className="flex items-start gap-1.5 text-xs">
                          <XCircle className="h-3 w-3 text-destructive flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 mb-1.5">Say instead</p>
                    <div className="space-y-1">
                      {['"The scan returned two active codes."', '"I\'ll document what I see."', '"All findings go into the report."', '"That\'s outside my role."'].map((s) => (
                        <div key={s} className="flex items-start gap-1.5 text-xs">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Seller refuses access to an area</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Document exactly what happened and what wasn't accessible. Continue the rest of the inspection. Seller refusals are never penalized when properly documented.</p>
                </div>
              </div>
            </GuideSectionBlock>

            {/* 8 — Safety & Escalation */}
            <GuideSectionBlock
              section={GUIDE_SECTIONS[7]}
              isRead={!!guideProgress["safety-escalation"]}
              onToggleRead={() => toggleGuideSection("safety-escalation")}
            >
              <p className="text-muted-foreground">Know when to message Ops and when to leave. Your safety is always first.</p>
              <div className="space-y-2">
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">Message Ops immediately when:</p>
                  <div className="space-y-1 mt-1">
                    {["Seller becomes hostile or aggressive", "Vehicle is not at the listed address", "Vehicle doesn't match the booking details", "You feel unsafe for any reason"].map((item) => (
                      <div key={item} className="flex items-start gap-2 text-xs">
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="text-red-700 dark:text-red-400">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="font-semibold text-xs mb-1">Never do</p>
                  <div className="space-y-1">
                    {[
                      "Accept cash, gifts, or tips from sellers or buyers",
                      "Share the buyer's identity or contact details with the seller",
                      "Enter a running vehicle without explicit permission",
                      "Negotiate on anyone's behalf",
                      "Promise any outcome or opinion on the vehicle",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2 text-xs">
                        <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">How to reach Ops during a job</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Open your assignment card → tap Message Ops. Available during all inspection hours. Don't wait — reach out as soon as an issue arises.</p>
                </div>
              </div>
            </GuideSectionBlock>

            {/* 9 — RideCheck Score */}
            <GuideSectionBlock
              section={GUIDE_SECTIONS[8]}
              isRead={!!guideProgress["ridechecker-score"]}
              onToggleRead={() => toggleGuideSection("ridechecker-score")}
            >
              <p className="text-muted-foreground">Your score is out of 100 and calculated on each completed inspection.</p>
              <div className="space-y-2">
                {[
                  { label: "Checklist Score", pts: "40 pts", desc: "All required fields completed across the 9 required sections." },
                  { label: "Photo Score", pts: "20 pts", desc: "15 pts base (4 required photos) + up to 5 pts bonus for additional photos." },
                  { label: "Notes Score", pts: "20 pts", desc: "Quality and detail of written notes. Each of 5 key sections must meet minimum length. Vague one-liners score low." },
                  { label: "Timeliness Score", pts: "20 pts", desc: "On-time = full 20 pts. Scales proportionally. More than 24 hours late = 4 pts." },
                ].map(({ label, pts, desc }) => (
                  <div key={label} className="flex items-start gap-3 bg-muted/40 rounded-lg p-3">
                    <div className="flex-1">
                      <p className="font-semibold text-xs">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <span className="text-sm font-bold text-primary flex-shrink-0">{pts}</span>
                  </div>
                ))}
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">What NEVER hurts your score</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">Documenting critical findings · seller refusals properly noted · marking areas as Not Accessible with explanation. Honest documentation is always correct.</p>
                </div>
              </div>
            </GuideSectionBlock>

            {/* 10 — Certification Path */}
            <GuideSectionBlock
              section={GUIDE_SECTIONS[9]}
              isRead={!!guideProgress["certification-path"]}
              onToggleRead={() => toggleGuideSection("certification-path")}
            >
              <p className="text-muted-foreground">Four tiers — advancement comes from consistency across many jobs.</p>
              <div className="space-y-2">
                {[
                  { tier: "Rookie", color: "bg-gray-500", req: "New to platform. Complete Module 1 (SIP-4) certification. Standard vehicle inspections only.", unlock: "Foundations certification required to start." },
                  { tier: "Trusted", color: "bg-[#22774F]", req: "10+ jobs · avg score ≥ 80 · zero no-shows.", unlock: "Preferred job routing, Trusted badge, more opportunities." },
                  { tier: "Elite", color: "bg-amber-700", req: "25+ jobs · avg score ≥ 88 · no serious incidents.", unlock: "Plus/Luxury vehicle inspections. Higher base pay." },
                  { tier: "Master", color: "bg-purple-700", req: "50+ jobs · avg score ≥ 93 · trainer-eligible.", unlock: "Exotic tier, QA track access, top pay rate." },
                ].map(({ tier, color, req, unlock }) => (
                  <div key={tier} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${color}`}>{tier}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{req}</p>
                    <p className="text-xs font-medium mt-1">{unlock}</p>
                  </div>
                ))}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">How to advance</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Consistency beats perfection. Complete every required section, take clear photos, write detailed notes — on every single job, every time.</p>
                </div>
              </div>
            </GuideSectionBlock>
          </div>

          {/* Guide complete actions */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            {guideCertified ? (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Operations Guide completed</p>
                  {guideCompletedAt && (
                    <p className="text-xs text-muted-foreground">
                      Completed {new Date(guideCompletedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {allSectionsRead ? "All sections read — ready to mark complete!" : `Read all sections to mark the guide complete (${sectionsRead}/${totalSections} done).`}
                </p>
                <Button
                  onClick={markGuideComplete}
                  disabled={markingComplete}
                  className="w-full"
                  variant={allSectionsRead ? "default" : "outline"}
                  data-testid="button-mark-guide-complete"
                >
                  {markingComplete ? (
                    <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span>
                  ) : (
                    <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Mark Guide as Completed</span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── SIP-4 Certification Module ─────────────────────────────── */}
        <div>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold" data-testid="text-training-title">
                  RideChecker Basic Certification
                </h2>
                <p className="text-sm text-muted-foreground">
                  Module 1 — Standardized Vehicle Assessment Protocol
                </p>
              </div>
            </div>
            {alreadyCertified && (
              <Badge variant="default" className="flex items-center gap-1.5 text-sm px-3 py-1" data-testid="badge-certified">
                <ShieldCheck className="h-3.5 w-3.5" />
                Certified
              </Badge>
            )}
          </div>

          {alreadyCertified && (
            <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                  You've passed Module 1
                </p>
                <p className="text-sm text-muted-foreground">
                  Your certification is active. You can now access vehicle assessment forms.
                </p>
              </div>
            </div>
          )}

          {!alreadyCertified && existingResult && (
            <div className="mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                  Previous attempt: {existingResult.score}% — {existingResult.attempts} attempt{existingResult.attempts !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Review the material below and retake the quiz. You need 80% to pass.
                </p>
              </div>
            </div>
          )}

          {!alreadyCertified && !existingResult && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Read the training material below, then take the 5-question knowledge check. You need 80% (4/5) to become certified. Unlimited retries allowed.
              </p>
            </div>
          )}
        </div>

        {/* ── SIP-4 Content Sections ─────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Certification Training Material
          </p>

          <Section icon={<Eye className="h-4 w-4 text-primary" />} title="Inspection Mindset — 4 Layers">
            <p className="text-muted-foreground mb-3">
              Every RideCheck assessment is built on four complementary inspection layers. You must evaluate all four — not just what you can see.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { layer: "Digital", desc: "OBD-II scan for stored and pending fault codes. The vehicle's computer is a witness — treat it as one." },
                { layer: "Functional", desc: "Operate every system — HVAC, windows, mirrors, locks, seats, all buttons. If you can click it, test it." },
                { layer: "Integrity", desc: "Look for evidence of prior repairs, inconsistent paint, gap variations, and any mileage irregularities." },
                { layer: "Structural", desc: "Inspect frames, rails, welds, and floor pans for rust, bends, or signs of collision repair." },
              ].map(({ layer, desc }) => (
                <div key={layer} className="bg-muted/40 rounded-lg p-3">
                  <p className="font-semibold text-sm mb-1">{layer}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={<Wrench className="h-4 w-4 text-primary" />} title="What to Test — Functional Checklist">
            <p className="text-muted-foreground mb-3">
              Test every accessible control and system. If it's in the vehicle, it's in your scope.
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {[
                "HVAC (heat, A/C, fan speeds, defrost)",
                "All interior lighting (dash, dome, map lights)",
                "Power windows — all doors",
                "Power mirrors (adjust and fold if equipped)",
                "Seat adjustments (all axes for powered seats)",
                "Audio / infotainment system",
                "Bluetooth / phone pairing",
                "Backup camera and parking sensors",
                "Wipers and washer fluid",
                "Horn",
                "Hazard lights and all turn signals",
                "Headlights (low, high, DRL)",
                "Sunroof / moonroof operation",
                "Remote start (if equipped)",
                "All door locks and latches",
                "Brake pedal firmness",
                "Parking brake engagement",
                "OBD-II scan (stored + pending codes)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={<Camera className="h-4 w-4 text-primary" />} title="What to Document — Photo Standards">
            <p className="text-muted-foreground mb-3">
              Photos are evidence. Every significant item requires two shots.
            </p>
            <div className="space-y-3">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="font-semibold text-sm mb-1">Close-Up Shot</p>
                <p className="text-xs text-muted-foreground">
                  Fill the frame with the specific detail — rust, chip, fault code on the scanner screen, wear mark, etc. The buyer must be able to see exactly what you saw.
                </p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="font-semibold text-sm mb-1">Wide Context Shot</p>
                <p className="text-xs text-muted-foreground">
                  Pull back and capture the surrounding area so the buyer can understand location and scale. A scratch on the driver door should also show the full door in context.
                </p>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Shoot in good lighting — use a flashlight for interior panels and undercarriage</li>
                <li>• Capture all four body corners plus the roof</li>
                <li>• Photograph the odometer and VIN plate</li>
                <li>• Document every OBD fault code on-screen</li>
                <li>• Photo must be sharp — blurry photos are rejected by QA</li>
              </ul>
            </div>
          </Section>

          <Section icon={<MessageSquareOff className="h-4 w-4 text-primary" />} title="What NOT to Say — Communication Rules">
            <p className="text-muted-foreground mb-3">
              Your job is to report observations — not to advise. Never tell a buyer whether to purchase.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-2">Never say</p>
                <ul className="space-y-1.5 text-xs">
                  {['"I would buy this car."', '"I wouldn\'t touch this one."', '"This is a great deal."', '"Walk away — this is a lemon."', '"The price is too high."', '"Based on my experience, this car is reliable."'].map((s) => (
                    <li key={s} className="flex items-start gap-2 text-muted-foreground">
                      <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Say instead</p>
                <ul className="space-y-1.5 text-xs">
                  {['"The OBD scan returned two active fault codes."', '"There is surface rust on the driver-side frame rail."', '"The odometer reads 87,432."', '"The A/C blower operates on all four speeds."', '"The left rear window does not respond to the door switch."', '"Panel gap between the hood and fender is wider on the left side."'].map((s) => (
                    <li key={s} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          <Section icon={<AlertCircle className="h-4 w-4 text-primary" />} title="Basic Red Flags">
            <p className="text-muted-foreground mb-3">
              These findings do not mean the car is bad — they mean they must be clearly documented and flagged in the report.
            </p>
            <div className="space-y-2">
              {[
                { flag: "Frame or structural rust", detail: "Surface rust on frame rails, crossmembers, or rocker panels. Especially significant on vehicles from non-rust-belt states." },
                { flag: "Mileage inconsistency", detail: "Odometer reading does not match service history, Carfax entries, or wear patterns on pedals, steering wheel, and seats." },
                { flag: "Active or pending OBD fault codes", detail: "Any DTC returned by the OBD-II scanner must be recorded by code, not just a general note. Cleared codes that return are significant." },
                { flag: "Inconsistent paint, panel gaps, or overspray", detail: "Evidence of prior body repair — overspray on rubber trim, misaligned gaps, or paint color / texture variance between panels." },
                { flag: "Non-original VIN or missing labels", detail: "Missing, altered, or non-matching VINs on the dash, door jamb, or engine bay require immediate documentation." },
              ].map(({ flag, detail }) => (
                <div key={flag} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">{flag}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ── Quiz ──────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold" data-testid="text-quiz-title">
              Module 1 Knowledge Check
            </h2>
            <Badge variant="outline" className="text-xs">5 Questions · 80% to pass</Badge>
          </div>

          {quizState === "passed" || alreadyCertified ? (
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
              <CardContent className="flex flex-col items-center py-10 text-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                  Certification Complete!
                </h3>
                {quizResult && (
                  <p className="text-sm text-muted-foreground">
                    You scored <strong>{quizResult.score}%</strong> ({quizResult.correct}/{quizResult.total} correct)
                  </p>
                )}
                <p className="text-sm text-muted-foreground max-w-sm">
                  You are now certified to perform vehicle assessments. You can access inspection forms from your dashboard.
                </p>
                <Button onClick={() => router.push("/ridechecker/dashboard")} data-testid="button-go-to-dashboard">
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          ) : quizState === "failed" && quizResult ? (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="flex flex-col items-center py-8 text-center gap-3">
                <XCircle className="h-12 w-12 text-amber-500" />
                <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300">
                  Not Passed — {quizResult.score}%
                </h3>
                <p className="text-sm text-muted-foreground">
                  You got {quizResult.correct} of {quizResult.total} correct. You need 80% (4/5) to pass.
                  Review the material above and try again — unlimited retries are allowed.
                </p>
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="flex items-center gap-2"
                  data-testid="button-retry-quiz"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry Quiz
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {QUESTIONS.map((q, idx) => (
                <Card key={q.id} data-testid={`card-question-${q.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      {idx + 1}. {q.text}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {q.options.map((opt) => {
                      const selected = answers[q.id] === opt.letter;
                      return (
                        <button
                          key={opt.letter}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.letter }))}
                          data-testid={`option-${q.id}-${opt.letter}`}
                          className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                            selected
                              ? "border-primary bg-primary/5 font-medium"
                              : "border-border hover:border-primary/40 hover:bg-muted/40"
                          }`}
                        >
                          <span className="font-medium mr-2">{opt.letter.toUpperCase()}.</span>
                          {opt.text}
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  {Object.keys(answers).length} of {QUESTIONS.length} answered
                  {!allAnswered && " — answer all questions to submit"}
                </p>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!allAnswered || quizState === "submitting"}
                  onClick={handleSubmitQuiz}
                  data-testid="button-submit-quiz"
                >
                  {quizState === "submitting" ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Grading…
                    </span>
                  ) : (
                    "Submit Quiz"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Resources ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Resources</p>

          {/* PDF Download */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-muted/40 transition-colors text-left disabled:opacity-60"
            data-testid="button-download-pdf"
          >
            {pdfLoading ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
            ) : (
              <Download className="h-5 w-5 text-primary flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">{pdfLoading ? "Generating PDF…" : "Download Training Guide PDF"}</p>
              <p className="text-xs text-muted-foreground">RideCheck-branded field reference · v1.0</p>
            </div>
          </button>

          {/* Spanish placeholder */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed opacity-60">
            <Globe className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Spanish Version</p>
              <p className="text-xs text-muted-foreground">Versión en español — próximamente / coming soon</p>
            </div>
          </div>
        </div>

        {/* Bottom spacer for mobile */}
        <div className="h-6" />
      </div>
    </AppShell>
  );
}
