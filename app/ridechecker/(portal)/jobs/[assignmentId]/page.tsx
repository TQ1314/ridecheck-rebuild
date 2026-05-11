"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  ArrowLeft,
  Car,
  MapPin,
  Calendar,
  Package,
  MessageSquare,
  CheckCircle2,
  Clock,
  Camera,
  Wrench,
  AlertTriangle,
  ClipboardList,
  Send,
  DollarSign,
  Zap,
  XCircle,
  Gauge,
  Star,
  ChevronDown,
  ChevronUp,
  Navigation,
} from "lucide-react";

interface AssignmentDetail {
  id: string;
  order_id: string;
  status: string;
  scheduled_start?: string;
  scheduled_end?: string;
  accepted_at?: string;
  started_at?: string;
  submitted_at?: string;
  payout_amount?: number;
  expires_at?: string | null;
  pay_amount?: number | null;
}

interface OrderDetail {
  id: string;
  order_id: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_trim?: string;
  vehicle_location?: string;
  inspection_address?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  package?: string;
  booking_type?: string;
  seller_name?: string;
  vehicle_mileage?: number | null;
  vehicle_price?: number | null;
}

// ── Package complexity context ─────────────────────────────────────────────
function getInspectionContext(pkg: string | undefined, make: string | undefined) {
  const isExotic = pkg === "exotic";
  const isPlus = pkg === "plus";
  const makeLower = (make || "").toLowerCase();
  const isLuxury = ["bmw", "mercedes", "audi", "lexus", "infiniti", "acura", "cadillac", "lincoln", "volvo", "genesis"].some((b) => makeLower.includes(b));
  const isEV = ["tesla", "rivian", "lucid", "polestar"].some((b) => makeLower.includes(b));

  if (isEV) {
    return {
      tier: "Electric Vehicle",
      color: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
      points: [
        "Battery health check — record pack size, range estimate, and any degradation",
        "Charging port inspection — check for damage or corrosion",
        "OBD-II scan using EV-compatible tool for fault codes",
        "Regenerative braking feel during test drive",
        "Software version and any pending updates",
        "Thermal management system inspection if accessible",
      ],
    };
  }
  if (isExotic) {
    return {
      tier: "Exotic / High-Value",
      color: "text-purple-700 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
      points: [
        "Full exterior panel gap and paint depth inspection",
        "VIN verification on multiple points (dash, door, firewall)",
        "Exhaust system and catalytic converters",
        "Suspension — check for aftermarket mods or worn bushings",
        "Interior — electronics, screens, leather condition",
        "Test drive — listen carefully for powertrain anomalies",
        "Fluids: brake, power steering, coolant, transmission",
      ],
    };
  }
  if (isPlus || isLuxury) {
    return {
      tier: "Plus / Luxury",
      color: "text-indigo-700 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800",
      points: [
        "Electronics suite: infotainment, driver assists, cameras",
        "Sunroof / panoramic roof seal and motor operation",
        "Heated/cooled seats and interior features",
        "Air suspension or adaptive shocks (if equipped)",
        "Full OBD scan — luxury ECUs store more fault data",
        "Exterior paint and body panel consistency",
      ],
    };
  }
  return {
    tier: "Standard",
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700",
    points: [
      "VIN plate verification",
      "OBD-II fault code scan",
      "Tire tread and brake condition",
      "Engine bay fluids and visual inspection",
      "Undercarriage rust and damage check",
      "Interior and exterior condition notes",
      "Test drive — brakes, acceleration, handling",
    ],
  };
}

// ── Countdown hook ─────────────────────────────────────────────────────────
function useCountdown(expiresAt: string | null | undefined) {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      setSecsLeft(Math.max(0, diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return secsLeft;
}

const PHOTO_CHECKLIST = [
  {
    icon: "🪪",
    label: "VIN Plate",
    where: "Driver's door jamb (sticker) and dashboard (visible through windshield)",
    tip: "Ensure all 17 characters are sharp and readable.",
  },
  {
    icon: "🔢",
    label: "Odometer",
    where: "Dashboard display with ignition on",
    tip: "Capture the full cluster — don't crop the mileage.",
  },
  {
    icon: "🔧",
    label: "Engine Bay",
    where: "Hood open, full overhead view",
    tip: "Show the entire engine bay, including fluid reservoirs.",
  },
  {
    icon: "🚗",
    label: "Undercarriage",
    where: "Low angle from front, sides, and rear",
    tip: "Look for rust, cracks, or leaks. Take at least 3 angles.",
  },
];

const WHAT_TO_BRING = [
  "OBD-II scanner",
  "Tire tread depth gauge (or coin gauge)",
  "Your phone — fully charged",
  "Flashlight (for undercarriage)",
];

const INSPECTION_STEPS = [
  { step: 1, title: "Confirm the vehicle", detail: "Verify the year, make, model, and VIN against the assignment details before starting." },
  { step: 2, title: "Take required photos", detail: "VIN plate, odometer, engine bay, and undercarriage. Take extras if you see anything worth documenting." },
  { step: 3, title: "Check tires & brakes", detail: "Measure tread depth on all four tires. Note brake condition (good / fair / poor)." },
  { step: 4, title: "Run OBD-II scan", detail: "Plug in your scanner with ignition on. Record all codes — cleared or active." },
  { step: 5, title: "Inspect exterior & interior", detail: "Note any dents, rust, cracks, stains, odors, or non-functional controls." },
  { step: 6, title: "Test drive", detail: "At least 10–15 minutes. Note any unusual sounds, vibrations, or handling issues." },
  { step: 7, title: "Flag immediate concerns", detail: "Anything safety-critical or deal-breaking must be called out clearly in the submission." },
];

const DECLINE_REASONS = [
  { value: "too_far", label: "Location is too far" },
  { value: "not_available", label: "I'm not available at this time" },
  { value: "vehicle_type", label: "Vehicle type outside my expertise" },
  { value: "scheduling_conflict", label: "Scheduling conflict" },
  { value: "other", label: "Other reason" },
];

function statusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    awaiting_acceptance: "outline",
    assigned: "outline",
    accepted: "secondary",
    in_progress: "secondary",
    submitted: "default",
    approved: "default",
    paid: "default",
    declined: "destructive",
    expired: "destructive",
    rejected: "destructive",
  };
  return variants[status] || "outline";
}

function formatStatus(s: string) {
  const labels: Record<string, string> = { awaiting_acceptance: "Awaiting Your Response" };
  return labels[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.assignmentId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgSending, setMsgSending] = useState(false);

  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineNote, setDeclineNote] = useState("");

  const [briefOpen, setBriefOpen] = useState(false);

  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateNote, setEscalateNote] = useState("");

  const secsLeft = useCountdown(
    assignment?.status === "awaiting_acceptance" ? assignment.expires_at : null
  );

  const loadDetail = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/auth/login");
      return;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!prof || !["ridechecker_active", "owner"].includes(prof.role)) {
      router.push("/auth/login");
      return;
    }

    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/detail`);
      if (res.ok) {
        const data = await res.json();
        setAssignment(data.assignment);
        setOrder(data.order);
        // Stamp first_viewed_at when RC opens a pending offer (best-effort)
        if (data.assignment?.status === "awaiting_acceptance") {
          fetch(`/api/ridechecker/jobs/${assignmentId}/mark-viewed`, { method: "POST" }).catch(() => {});
        }
      } else {
        toast({ title: "Assignment not found", variant: "destructive" });
        router.push("/ridechecker/jobs");
      }
    } catch {
      toast({ title: "Failed to load assignment", variant: "destructive" });
    }

    setLoading(false);
  }, [assignmentId, router, toast]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  async function acceptAssignment() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/accept`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Job accepted!", description: "You're confirmed for this inspection." });
        setAssignment((prev) => prev ? { ...prev, status: "accepted" } : prev);
      } else {
        const d = await res.json();
        toast({ title: d.error || "Failed to accept", variant: "destructive" });
        if (res.status === 410) {
          setAssignment((prev) => prev ? { ...prev, status: "expired" } : prev);
        }
      }
    } catch {
      toast({ title: "Failed to accept", variant: "destructive" });
    }
    setActionLoading(false);
  }

  async function declineAssignment() {
    if (!declineReason) {
      toast({ title: "Please select a reason", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason, note: declineNote || null }),
      });
      if (res.ok) {
        toast({ title: "Job declined", description: "Ops has been notified to reassign." });
        router.push("/ridechecker/jobs");
      } else {
        const d = await res.json();
        toast({ title: d.error || "Failed to decline", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to decline", variant: "destructive" });
    }
    setActionLoading(false);
  }

  async function startAssignment() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/start`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Inspection started!" });
        router.push(`/ridechecker/jobs/${assignmentId}/submit`);
      } else {
        const d = await res.json();
        toast({ title: d.error || "Failed to start", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to start", variant: "destructive" });
    }
    setActionLoading(false);
  }

  async function updateStatus(newStatus: string, notes?: string) {
    setActionLoading(true);
    try {
      // Capture GPS when going en_route
      if (newStatus === "en_route" && typeof navigator !== "undefined" && "geolocation" in navigator) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              await fetch(`/api/ridechecker/jobs/${assignmentId}/location`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              }).catch(() => {});
              resolve();
            },
            () => resolve(),
            { timeout: 5000 }
          );
        });
      }

      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_status: newStatus, notes: notes ?? null }),
      });

      if (res.ok) {
        const data = await res.json();
        const labels: Record<string, string> = {
          en_route:           "You're on your way! Ops has been notified.",
          arrived:            "Arrival confirmed. Start your inspection when ready.",
          inspection_started: "Inspection started. Complete each step carefully.",
          photos_uploading:   "Photo upload stage marked. Keep going!",
          report_pending:     "Report marked as pending. Ops will be notified.",
          escalated:          "Issue reported. Ops has been alerted.",
        };
        toast({ title: labels[newStatus] ?? "Status updated." });
        setAssignment((prev) =>
          prev ? { ...prev, status: data.assignment?.status ?? newStatus } : prev
        );
        setShowEscalate(false);
        setEscalateNote("");
        if (newStatus === "inspection_started") {
          router.push(`/ridechecker/jobs/${assignmentId}/submit`);
        }
      } else {
        const d = await res.json();
        toast({ title: d.error || "Failed to update status", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
    setActionLoading(false);
  }

  async function sendMessage() {
    if (!msgText.trim()) return;
    setMsgSending(true);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/message-ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgText.trim() }),
      });
      if (res.ok) {
        toast({ title: "Message sent to ops team!" });
        setMsgText("");
        setMsgOpen(false);
      } else {
        const d = await res.json();
        toast({ title: d.error || "Failed to send", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
    setMsgSending(false);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </AppShell>
    );
  }

  if (!assignment) return null;

  const isPendingAcceptance = assignment.status === "awaiting_acceptance";
  const isExpired = assignment.status === "expired" || (secsLeft !== null && secsLeft === 0 && isPendingAcceptance);
  const canAccept = isPendingAcceptance && !isExpired;

  // New granular lifecycle flags
  const canEnRoute         = assignment.status === "accepted";
  const canMarkArrived     = assignment.status === "en_route";
  const canStartInspection = assignment.status === "arrived";
  const canMarkUploading   = assignment.status === "inspection_started";
  const canMarkPending     = assignment.status === "photos_uploading";

  const canSubmit = ["in_progress", "report_pending"].includes(assignment.status);
  const isSubmitted = ["submitted", "approved", "paid"].includes(assignment.status);
  const isDeclined = ["declined", "rejected"].includes(assignment.status);
  const isEscalated = assignment.status === "escalated";

  const canEscalate = [
    "accepted", "en_route", "arrived", "inspection_started",
    "photos_uploading", "report_pending", "in_progress",
  ].includes(assignment.status);

  const ctx = getInspectionContext(order?.package, order?.vehicle_make);
  const payAmount = assignment.pay_amount ?? assignment.payout_amount;

  const minsLeft = secsLeft !== null ? Math.floor(secsLeft / 60) : null;
  const sLeft = secsLeft !== null ? secsLeft % 60 : null;

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto pb-32">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link href="/ridechecker/jobs">
            <Button size="icon" variant="ghost" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate" data-testid="text-job-title">
              {order
                ? `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`
                : "Job Detail"}
            </h1>
            <p className="text-sm text-muted-foreground">Assignment brief</p>
          </div>
          <Badge variant={statusBadge(assignment.status)} data-testid="badge-assignment-status">
            {formatStatus(assignment.status)}
          </Badge>
        </div>

        {/* ── Action Required Banner ──────────────────────────── */}
        {isPendingAcceptance && !isExpired && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="font-bold text-amber-800 dark:text-amber-300">Job Offer — Response Required</p>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Review the details below, then accept or decline. If no response is received in time, the offer will expire automatically.
            </p>
            <div className="text-xs text-amber-600 dark:text-amber-500 border-t border-amber-200 dark:border-amber-700 pt-2 mt-1">
              <span className="font-semibold">Reminder:</span> 3 declines in 30 days triggers a warning. 5 declines in 30 days results in automatic account suspension.
            </div>
            {secsLeft !== null && (
              <div className={`inline-flex items-center gap-2 font-bold text-lg px-3 py-1 rounded-lg ${
                secsLeft < 180
                  ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }`} data-testid="text-countdown">
                <Clock className="h-5 w-5" />
                {minsLeft}m {sLeft! < 10 ? "0" : ""}{sLeft}s remaining
              </div>
            )}
          </div>
        )}

        {isExpired && (
          <div className="rounded-xl border border-gray-300 bg-gray-50 dark:bg-gray-900/30 dark:border-gray-700 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">Offer Expired</p>
              <p className="text-sm text-muted-foreground">This job offer has expired. Contact ops if you'd like to be reassigned.</p>
            </div>
          </div>
        )}

        {isDeclined && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">Job Declined</p>
              <p className="text-sm text-muted-foreground">You declined this job. Ops has been notified to reassign.</p>
            </div>
          </div>
        )}

        {/* ── Pay ──────────────────────────────────────────────── */}
        {payAmount != null && (
          <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-5 w-5 text-green-700 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Pay</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-pay-amount">
                  ${payAmount}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Vehicle ──────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <Car className="h-4 w-4" />
              Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold text-lg" data-testid="text-vehicle-full">
              {order?.vehicle_year} {order?.vehicle_make} {order?.vehicle_model}
              {order?.vehicle_trim ? ` — ${order.vehicle_trim}` : ""}
            </p>
            <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
              {order?.package && (
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  <span className="capitalize">{order.package} Package</span>
                </div>
              )}
              {order?.vehicle_mileage != null && (
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5" />
                  <span>{order.vehicle_mileage.toLocaleString()} mi</span>
                </div>
              )}
              {order?.vehicle_price != null && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>${order.vehicle_price.toLocaleString()} asking</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Inspection Complexity ─────────────────────────────── */}
        <Card className={`border ${ctx.bg}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-semibold flex items-center gap-2 uppercase tracking-wide ${ctx.color}`}>
              <Star className="h-4 w-4" />
              What This Inspection Involves — {ctx.tier}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {ctx.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${ctx.color}`} />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ── Location & Schedule ───────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <MapPin className="h-4 w-4" />
              Location &amp; Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(order?.inspection_address || order?.vehicle_location) && (
              <div className="space-y-1.5">
                <p className="font-medium" data-testid="text-inspection-address">
                  {order.inspection_address || order.vehicle_location}
                </p>
                {order?.inspection_address && order?.vehicle_location &&
                  order.inspection_address !== order.vehicle_location && (
                    <p className="text-xs text-muted-foreground">
                      Vehicle listed at: {order.vehicle_location}
                    </p>
                  )}
                <div className="flex gap-2 flex-wrap">
                  <a
                    href={`https://maps.google.com/maps?daddr=${encodeURIComponent(
                      order.inspection_address || order.vehicle_location || ""
                    )}&saddr=My+Location`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-white bg-[#22774F] hover:bg-[#1a5e3e] px-3 py-1.5 rounded-md"
                    data-testid="link-directions"
                  >
                    <MapPin className="h-3 w-3" />
                    Get Directions from My Location
                  </a>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(
                      order.inspection_address || order.vehicle_location || ""
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded-md px-2 py-1.5 hover:bg-muted"
                    data-testid="link-maps"
                  >
                    View on Map
                  </a>
                </div>
              </div>
            )}
            {(order?.scheduled_date || assignment.scheduled_start) && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span data-testid="text-scheduled-time">
                  {order?.scheduled_date || ""}
                  {order?.scheduled_time ? ` at ${order.scheduled_time}` : ""}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Seller ───────────────────────────────────────────── */}
        {order?.seller_name && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                <MessageSquare className="h-4 w-4" />
                Seller
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium" data-testid="text-seller-name">{order.seller_name}</p>
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Do not contact the seller directly. Message the ops team below if needed.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Inspection Brief (collapsible when in pending mode) ─ */}
        {(canAccept || isExpired) ? (
          <Card>
            <button
              className="w-full flex items-center justify-between p-4 text-left"
              onClick={() => setBriefOpen((v) => !v)}
              data-testid="button-toggle-brief"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <ClipboardList className="h-4 w-4" />
                Inspection Brief
              </span>
              {briefOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {briefOpen && (
              <CardContent className="pt-0 space-y-4">
                <InspectionBriefContent />
              </CardContent>
            )}
          </Card>
        ) : (
          <>
            <WhatToBringCard />
            <RequiredPhotosCard />
            <InspectionStepsCard />
          </>
        )}

        {/* ── Message Ops ──────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <MessageSquare className="h-4 w-4" />
              Message Ops
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Questions about this job? The ops team will follow up directly.
            </p>
            {!msgOpen && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setMsgOpen(true)}
                data-testid="button-open-message-ops"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Send a Message to Ops
              </Button>
            )}
            {msgOpen && (
              <div className="space-y-2">
                <Textarea
                  placeholder="e.g. Seller isn't at the location, what should I do?"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="resize-none"
                  data-testid="textarea-ops-message"
                />
                <div className="flex items-center gap-2">
                  <Button
                    className="flex-1"
                    onClick={sendMessage}
                    disabled={!msgText.trim() || msgSending}
                    data-testid="button-send-ops-message"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {msgSending ? "Sending…" : "Send"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { setMsgOpen(false); setMsgText(""); }}
                    data-testid="button-cancel-message"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Decline form (inline) ─────────────────────────────── */}
        {showDecline && canAccept && (
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700 dark:text-red-400 uppercase tracking-wide">
                <XCircle className="h-4 w-4" />
                Decline This Job
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Please let us know why so we can improve future assignments.
              </p>
              <div className="space-y-2">
                {DECLINE_REASONS.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      declineReason === r.value
                        ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                        : "border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="decline-reason"
                      value={r.value}
                      checked={declineReason === r.value}
                      onChange={() => setDeclineReason(r.value)}
                      className="accent-red-600"
                      data-testid={`radio-decline-${r.value}`}
                    />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>
              {declineReason === "other" && (
                <Textarea
                  placeholder="Tell us more (optional)…"
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="resize-none"
                  data-testid="textarea-decline-note"
                />
              )}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={declineAssignment}
                  disabled={actionLoading || !declineReason}
                  data-testid="button-confirm-decline"
                >
                  {actionLoading ? "Declining…" : "Confirm Decline"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowDecline(false); setDeclineReason(""); setDeclineNote(""); }}
                  data-testid="button-cancel-decline"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Escalate Form ────────────────────────────────────── */}
      {showEscalate && canEscalate && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700 dark:text-red-400 uppercase tracking-wide">
              <AlertTriangle className="h-4 w-4" />
              Report an Issue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Describe the issue so ops can take action. This escalates your assignment immediately.
            </p>
            <Textarea
              placeholder="e.g. Seller not responding, vehicle not at listed location, safety concern…"
              value={escalateNote}
              onChange={(e) => setEscalateNote(e.target.value)}
              rows={3}
              maxLength={600}
              className="resize-none"
              data-testid="textarea-escalate-note"
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => updateStatus("escalated", escalateNote || undefined)}
                disabled={actionLoading || !escalateNote.trim()}
                data-testid="button-confirm-escalate"
              >
                {actionLoading ? "Reporting…" : "Report Issue to Ops"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowEscalate(false); setEscalateNote(""); }}
                data-testid="button-cancel-escalate"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sticky Bottom Actions ─────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-10">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Accept / Decline */}
          {canAccept && (
            <>
              <Button
                className="w-full h-12 text-base bg-green-600 hover:bg-green-700 text-white"
                onClick={acceptAssignment}
                disabled={actionLoading}
                data-testid="button-accept-assignment"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                {actionLoading ? "Accepting…" : "Accept This Job"}
              </Button>
              {!showDecline && (
                <Button
                  variant="outline"
                  className="w-full h-10 text-sm border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400"
                  onClick={() => setShowDecline(true)}
                  data-testid="button-open-decline"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline Job
                </Button>
              )}
            </>
          )}

          {/* En Route */}
          {canEnRoute && (
            <Button
              className="w-full h-12 text-base bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => updateStatus("en_route")}
              disabled={actionLoading}
              data-testid="button-mark-en-route"
            >
              <Navigation className="h-5 w-5 mr-2" />
              {actionLoading ? "Updating…" : "I'm On My Way"}
            </Button>
          )}

          {/* Arrived */}
          {canMarkArrived && (
            <Button
              className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => updateStatus("arrived")}
              disabled={actionLoading}
              data-testid="button-mark-arrived"
            >
              <MapPin className="h-5 w-5 mr-2" />
              {actionLoading ? "Updating…" : "I've Arrived"}
            </Button>
          )}

          {/* Start Inspection */}
          {canStartInspection && (
            <Button
              className="w-full h-12 text-base"
              onClick={() => updateStatus("inspection_started")}
              disabled={actionLoading}
              data-testid="button-start-inspection"
            >
              <Camera className="h-5 w-5 mr-2" />
              {actionLoading ? "Starting…" : "Start Inspection"}
            </Button>
          )}

          {/* Uploading Photos */}
          {canMarkUploading && (
            <div className="space-y-2">
              <Button
                className="w-full h-12 text-base bg-cyan-600 hover:bg-cyan-700 text-white"
                onClick={() => updateStatus("photos_uploading")}
                disabled={actionLoading}
                data-testid="button-mark-uploading"
              >
                <Camera className="h-5 w-5 mr-2" />
                {actionLoading ? "Updating…" : "Now Uploading Photos"}
              </Button>
              <Link href={`/ridechecker/jobs/${assignmentId}/submit`}>
                <Button variant="outline" className="w-full h-10 text-sm" data-testid="button-go-submit-early">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Go to Submission Form
                </Button>
              </Link>
            </div>
          )}

          {/* Report Pending */}
          {canMarkPending && (
            <div className="space-y-2">
              <Button
                className="w-full h-12 text-base bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => updateStatus("report_pending")}
                disabled={actionLoading}
                data-testid="button-mark-report-pending"
              >
                <ClipboardList className="h-5 w-5 mr-2" />
                {actionLoading ? "Updating…" : "Mark Report Pending"}
              </Button>
              <Link href={`/ridechecker/jobs/${assignmentId}/submit`}>
                <Button variant="outline" className="w-full h-10 text-sm" data-testid="button-go-submit-pending">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Go to Submission Form
                </Button>
              </Link>
            </div>
          )}

          {/* Continue Submission (legacy in_progress / report_pending) */}
          {canSubmit && (
            <Link href={`/ridechecker/jobs/${assignmentId}/submit`}>
              <Button className="w-full h-12 text-base" data-testid="button-go-to-submit">
                <ClipboardList className="h-5 w-5 mr-2" />
                Continue Submission
              </Button>
            </Link>
          )}

          {/* Submitted */}
          {isSubmitted && (
            <div className="flex items-center justify-center gap-2 h-12 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              Submitted — awaiting QA review
            </div>
          )}

          {/* Escalated */}
          {isEscalated && (
            <div className="flex items-center justify-center gap-2 h-12 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-medium">
              <AlertTriangle className="h-5 w-5" />
              Issue Reported — ops has been alerted
            </div>
          )}

          {/* Escalate button (secondary, shown in active states) */}
          {canEscalate && !showEscalate && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-9 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={() => setShowEscalate(true)}
              data-testid="button-open-escalate"
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Report Issue / Delay
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function InspectionBriefContent() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">What to Bring</p>
        <ul className="space-y-1.5">
          {WHAT_TO_BRING.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Required Photos</p>
        <div className="space-y-2">
          {PHOTO_CHECKLIST.map((p) => (
            <div key={p.label} className="flex items-start gap-2 p-2 bg-muted/40 rounded-lg">
              <span className="text-lg leading-none mt-0.5">{p.icon}</span>
              <div>
                <p className="font-medium text-sm">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.where}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WhatToBringCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
          <ClipboardList className="h-4 w-4" />
          What to Bring
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {WHAT_TO_BRING.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RequiredPhotosCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
          <Camera className="h-4 w-4" />
          Required Photos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {PHOTO_CHECKLIST.map((p) => (
            <div key={p.label} className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
              <span className="text-xl leading-none mt-0.5">{p.icon}</span>
              <div className="min-w-0">
                <p className="font-medium text-sm">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.where}</p>
                <p className="text-xs text-primary mt-0.5">Tip: {p.tip}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InspectionStepsCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
          <Wrench className="h-4 w-4" />
          Inspection Steps
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {INSPECTION_STEPS.map((s) => (
            <li key={s.step} className="flex items-start gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {s.step}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="font-medium text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
