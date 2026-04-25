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
} from "lucide-react";

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

// ── Content section toggle ─────────────────────────────────────────────────

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

// ── Main Page ──────────────────────────────────────────────────────────────

type PageState = "loading" | "unauthorized" | "ready";
type QuizState = "idle" | "submitting" | "passed" | "failed";

export default function RideCheckerTrainingPage() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [profile, setProfile] = useState<any>(null);
  const [existingResult, setExistingResult] = useState<any>(null);
  const [alreadyCertified, setAlreadyCertified] = useState(false);

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

      // Suspended accounts (is_active = false) cannot access training
      if (!prof.is_active && prof.role !== "owner" && prof.role !== "operations_lead") {
        setPageState("unauthorized");
        return;
      }

      setProfile(prof);
      setAlreadyCertified(prof.training_sip4_completed === true);

      // Fetch existing quiz result
      const statusRes = await fetch("/api/ridechecker/training/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.result) {
          setExistingResult(statusData.result);
        }
      }

      setPageState("ready");
    }
    load();
  }, []);

  const allAnswered = QUESTIONS.every((q) => !!answers[q.id]);

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
      if (data.passed) {
        setAlreadyCertified(true);
      }
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

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-training-title">
                  RideChecker Basic Certification
                </h1>
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
            <div className="mt-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex gap-3">
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
            <div className="mt-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
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
        </div>

        {/* ── Content Sections ── */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Training Material
          </p>

          <Section icon={<Eye className="h-4 w-4 text-primary" />} title="Inspection Mindset — 4 Layers">
            <p className="text-muted-foreground mb-3">
              Every RideCheck assessment is built on four complementary inspection layers. You must evaluate all four — not just what you can see.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  layer: "Digital",
                  desc: "OBD-II scan for stored and pending fault codes. The vehicle's computer is a witness — treat it as one.",
                },
                {
                  layer: "Functional",
                  desc: "Operate every system — HVAC, windows, mirrors, locks, seats, all buttons. If you can click it, test it.",
                },
                {
                  layer: "Integrity",
                  desc: "Look for evidence of prior repairs, inconsistent paint, gap variations, and any mileage irregularities.",
                },
                {
                  layer: "Structural",
                  desc: "Inspect frames, rails, welds, and floor pans for rust, bends, or signs of collision repair.",
                },
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
                  Fill the frame with the specific detail — rust, chip, fault code on the scanner screen,
                  wear mark, etc. The buyer must be able to see exactly what you saw.
                </p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="font-semibold text-sm mb-1">Wide Context Shot</p>
                <p className="text-xs text-muted-foreground">
                  Pull back and capture the surrounding area so the buyer can understand location
                  and scale. A scratch on the driver door should also show the full door in context.
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
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-2">
                  Never say
                </p>
                <ul className="space-y-1.5 text-xs">
                  {[
                    '"I would buy this car."',
                    '"I wouldn\'t touch this one."',
                    '"This is a great deal."',
                    '"Walk away — this is a lemon."',
                    '"The price is too high."',
                    '"Based on my experience, this car is reliable."',
                  ].map((s) => (
                    <li key={s} className="flex items-start gap-2 text-muted-foreground">
                      <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">
                  Say instead
                </p>
                <ul className="space-y-1.5 text-xs">
                  {[
                    '"The OBD scan returned two active fault codes."',
                    '"There is surface rust on the driver-side frame rail."',
                    '"The odometer reads 87,432. The CarFax shows 61,000 at last service."',
                    '"The A/C blower operates on all four speeds."',
                    '"The left rear window does not respond to the door switch."',
                    '"Panel gap between the hood and fender is wider than the opposite side."',
                  ].map((s) => (
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
              These findings do not mean the car is bad — they mean they must be clearly documented
              and flagged in the report.
            </p>
            <div className="space-y-2">
              {[
                {
                  flag: "Frame or structural rust",
                  detail:
                    "Surface rust on frame rails, crossmembers, or rocker panels. Especially significant on vehicles from non-rust-belt states.",
                },
                {
                  flag: "Mileage inconsistency",
                  detail:
                    "Odometer reading does not match service history, Carfax entries, or wear patterns on pedals, steering wheel, and seats.",
                },
                {
                  flag: "Active or pending OBD fault codes",
                  detail:
                    "Any DTC returned by the OBD-II scanner must be recorded by code, not just a general note. Cleared codes that return are significant.",
                },
                {
                  flag: "Inconsistent paint, panel gaps, or overspray",
                  detail:
                    "Evidence of prior body repair — overspray on rubber trim, misaligned gaps, or paint color / texture variance between panels.",
                },
                {
                  flag: "Non-original VIN or missing labels",
                  detail:
                    "Missing, altered, or non-matching VINs on the dash, door jamb, or engine bay require immediate documentation.",
                },
              ].map(({ flag, detail }) => (
                <div key={flag} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">{flag}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ── Quiz ── */}
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
      </div>
    </AppShell>
  );
}
