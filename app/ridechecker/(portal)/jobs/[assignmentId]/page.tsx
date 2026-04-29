"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
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
  Gauge,
  AlertTriangle,
  ClipboardList,
  Send,
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
  {
    step: 1,
    title: "Confirm the vehicle",
    detail:
      "Verify the year, make, model, and VIN against the assignment details before starting.",
  },
  {
    step: 2,
    title: "Take required photos",
    detail:
      "VIN plate, odometer, engine bay, and undercarriage. Take extras if you see anything worth documenting.",
  },
  {
    step: 3,
    title: "Check tires & brakes",
    detail:
      "Measure tread depth on all four tires. Note brake condition (good / fair / poor).",
  },
  {
    step: 4,
    title: "Run OBD-II scan",
    detail:
      "Plug in your scanner with ignition on. Record all codes — cleared or active.",
  },
  {
    step: 5,
    title: "Inspect exterior & interior",
    detail:
      "Note any dents, rust, cracks, stains, odors, or non-functional controls.",
  },
  {
    step: 6,
    title: "Test drive",
    detail:
      "At least 10–15 minutes. Note any unusual sounds, vibrations, or handling issues.",
  },
  {
    step: 7,
    title: "Flag immediate concerns",
    detail:
      "Anything safety-critical or deal-breaking must be called out clearly in the submission.",
  },
];

function statusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    assigned: "outline",
    accepted: "secondary",
    in_progress: "secondary",
    submitted: "default",
    approved: "default",
    paid: "default",
    rejected: "destructive",
  };
  return variants[status] || "outline";
}

function formatStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

  useEffect(() => {
    async function load() {
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
        } else {
          toast({ title: "Assignment not found", variant: "destructive" });
          router.push("/ridechecker/jobs");
        }
      } catch {
        toast({ title: "Failed to load assignment", variant: "destructive" });
      }

      setLoading(false);
    }
    load();
  }, [assignmentId]);

  async function acceptAssignment() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/accept`, {
        method: "POST",
      });
      if (res.ok) {
        toast({ title: "Assignment accepted!" });
        setAssignment((prev) => prev ? { ...prev, status: "accepted" } : prev);
      } else {
        const d = await res.json();
        toast({ title: d.error || "Failed to accept", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to accept", variant: "destructive" });
    }
    setActionLoading(false);
  }

  async function startAssignment() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ridechecker/jobs/${assignmentId}/start`, {
        method: "POST",
      });
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

  async function sendMessage() {
    if (!msgText.trim()) return;
    setMsgSending(true);
    try {
      const res = await fetch(
        `/api/ridechecker/jobs/${assignmentId}/message-ops`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msgText.trim() }),
        }
      );
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

  const canAccept = assignment.status === "assigned";
  const canStart = assignment.status === "accepted";
  const canSubmit = assignment.status === "in_progress";
  const isSubmitted = ["submitted", "approved", "paid"].includes(assignment.status);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-5 max-w-2xl mx-auto pb-10">
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
          <Badge
            variant={statusBadge(assignment.status)}
            data-testid="badge-assignment-status"
          >
            {formatStatus(assignment.status)}
          </Badge>
        </div>

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
            {order?.package && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span className="capitalize">{order.package} Package</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <MapPin className="h-4 w-4" />
              Location &amp; Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(order?.inspection_address || order?.vehicle_location) && (
              <div className="space-y-0.5">
                <p className="font-medium" data-testid="text-inspection-address">
                  {order.inspection_address || order.vehicle_location}
                </p>
                {order?.inspection_address && order?.vehicle_location &&
                  order.inspection_address !== order.vehicle_location && (
                    <p className="text-xs text-muted-foreground">
                      Vehicle listed at: {order.vehicle_location}
                    </p>
                  )}
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(
                    order.inspection_address || order.vehicle_location || ""
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline underline-offset-2"
                  data-testid="link-maps"
                >
                  Open in Maps
                </a>
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

        {order?.seller_name && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                <MessageSquare className="h-4 w-4" />
                Seller
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium" data-testid="text-seller-name">
                {order.seller_name}
              </p>
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Do not contact the seller directly. If you need to reach them,
                  message the ops team below and they will coordinate.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                <div
                  key={p.label}
                  className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg"
                >
                  <span className="text-xl leading-none mt-0.5">{p.icon}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.where}</p>
                    <p className="text-xs text-primary mt-0.5">
                      Tip: {p.tip}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <MessageSquare className="h-4 w-4" />
              Message Ops
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Questions about this job? Send a message — the ops team will
              follow up with you directly.
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
                    onClick={() => {
                      setMsgOpen(false);
                      setMsgText("");
                    }}
                    data-testid="button-cancel-message"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="sticky bottom-4 pt-2">
          {canAccept && (
            <Button
              className="w-full h-12 text-base"
              onClick={acceptAssignment}
              disabled={actionLoading}
              data-testid="button-accept-assignment"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {actionLoading ? "Accepting…" : "Accept Assignment"}
            </Button>
          )}
          {canStart && (
            <Button
              className="w-full h-12 text-base"
              onClick={startAssignment}
              disabled={actionLoading}
              data-testid="button-start-inspection"
            >
              <Camera className="h-5 w-5 mr-2" />
              {actionLoading ? "Starting…" : "Start Inspection"}
            </Button>
          )}
          {canSubmit && (
            <Link href={`/ridechecker/jobs/${assignmentId}/submit`}>
              <Button
                className="w-full h-12 text-base"
                data-testid="button-go-to-submit"
              >
                <ClipboardList className="h-5 w-5 mr-2" />
                Continue Submission
              </Button>
            </Link>
          )}
          {isSubmitted && (
            <div className="flex items-center justify-center gap-2 h-12 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              Submitted — awaiting QA review
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
