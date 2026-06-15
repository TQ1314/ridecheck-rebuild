"use client";

import { useState, useEffect, useCallback, useId } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DollarSign,
  Calculator,
  Save,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Zap,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Clock,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompOffer {
  id: string;
  version: number;
  base_pay: number;
  distance_bonus: number;
  same_day_bonus: number;
  rush_bonus: number;
  surge_bonus: number;
  total_offer: number;
  pay_status: string;
  package_type: string | null;
  distance_miles: number | null;
  is_same_day: boolean;
  is_rush: boolean;
  is_current: boolean;
  is_manual_review: boolean;
  requires_ops_lead: boolean;
  override_requested_by: string | null;
  override_approved_by: string | null;
  override_reason: string | null;
  saved_at: string | null;
  calculated_at: string;
  surge_note: string | null;
}

interface CompPreview {
  basePay: number;
  distanceBonus: number;
  sameDayBonus: number;
  rushBonus: number;
  surgeBonus: number;
  totalOffer: number;
  isSameDay: boolean;
  isRush: boolean;
  isManualReview: boolean;
  requiresOpsLead: boolean;
  notes: string[];
}

interface Props {
  order: Order;
  onRefresh: () => void;
  userRole: string;
  highlighted?: boolean;
}

const OPS_LEAD_ROLES = ["operations_lead", "ops_lead", "admin", "owner"];

function statusBadge(status: string) {
  switch (status) {
    case "saved":
      return <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700">Saved</Badge>;
    case "override_requested":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700">Override Requested</Badge>;
    case "override_approved":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700">Override Approved</Badge>;
    case "assigned":
      return <Badge className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700">Assigned</Badge>;
    default:
      return <Badge variant="outline">Draft</Badge>;
  }
}

function LineItem({ label, amount, highlight }: { label: string; amount: number; highlight?: boolean }) {
  if (amount === 0) return null;
  return (
    <div className={`flex justify-between text-sm ${highlight ? "text-green-700 dark:text-green-400 font-medium" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span>+${amount}</span>
    </div>
  );
}

export function RideCheckerCompensationPanel({ order, onRefresh, userRole, highlighted }: Props) {
  const { toast } = useToast();
  const isLead = OPS_LEAD_ROLES.includes(userRole);

  const [currentOffer, setCurrentOffer] = useState<CompOffer | null>(null);
  const [history, setHistory] = useState<CompOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Calculation inputs
  const [distanceMiles, setDistanceMiles] = useState<string>("");
  const [preview, setPreview] = useState<CompPreview | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Override
  const [overrideReason, setOverrideReason] = useState("");
  const [requestingOverride, setRequestingOverride] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [approvingOverride, setApprovingOverride] = useState(false);
  const [rejectingOverride, setRejectingOverride] = useState(false);

  // Ops lead manual pay overrides
  const [manualBase, setManualBase] = useState<string>("");
  const [showManualOverride, setShowManualOverride] = useState(false);

  // Surge
  const [surgeAmount, setSurgeAmount] = useState<string>("");
  const [surgeNote, setSurgeNote] = useState<string>("");
  const [addingSurge, setAddingSurge] = useState(false);
  const [showSurgeForm, setShowSurgeForm] = useState(false);

  // Highlight pulse
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (highlighted) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 3000);
      return () => clearTimeout(t);
    }
  }, [highlighted]);

  const loadOffer = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/compensation`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setLoadError(errData.error ?? "Compensation module unavailable. Run migration 056 to enable it.");
        return;
      }
      const data = await res.json();
      setCurrentOffer(data.current ?? null);
      setHistory(data.history ?? []);
    } catch {
      setLoadError("Unable to load compensation data. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [order.id]);

  useEffect(() => { loadOffer(); }, [loadOffer]);

  async function handleCalculate() {
    setCalculating(true);
    setPreview(null);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/compensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "calculate",
          distance_miles: distanceMiles ? parseFloat(distanceMiles) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Calculation error", description: data.error, variant: "destructive" });
        return;
      }
      setPreview(data.preview);
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setCalculating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        action: "save",
        distance_miles: distanceMiles ? parseFloat(distanceMiles) : undefined,
      };
      if (isLead && manualBase) {
        body.base_pay_override = parseInt(manualBase, 10);
      }
      const res = await fetch(`/api/ops/orders/${order.id}/compensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Save failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Offer saved", description: `Total offer: $${data.total_offer}` });
      setPreview(null);
      setManualBase("");
      setShowManualOverride(false);
      await loadOffer();
      onRefresh();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestOverride() {
    if (!overrideReason.trim()) {
      toast({ title: "Reason required", description: "Please provide an override reason.", variant: "destructive" });
      return;
    }
    setRequestingOverride(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/compensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_override", override_reason: overrideReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Request failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Override requested", description: "An Ops Lead will review and approve." });
      setOverrideReason("");
      setShowOverrideForm(false);
      await loadOffer();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setRequestingOverride(false);
    }
  }

  async function handleApproveOverride() {
    setApprovingOverride(true);
    try {
      const body: Record<string, unknown> = { action: "approve_override" };
      if (manualBase) body.base_pay_override = parseInt(manualBase, 10);
      const res = await fetch(`/api/ops/orders/${order.id}/compensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Approval failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Override approved", description: `Total offer set to $${data.total_offer}` });
      setManualBase("");
      setShowManualOverride(false);
      await loadOffer();
      onRefresh();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setApprovingOverride(false);
    }
  }

  async function handleRejectOverride() {
    setRejectingOverride(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/compensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject_override" }),
      });
      if (!res.ok) {
        toast({ title: "Rejection failed", variant: "destructive" });
        return;
      }
      toast({ title: "Override rejected — offer returned to saved state." });
      await loadOffer();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setRejectingOverride(false);
    }
  }

  async function handleAddSurge() {
    const amt = parseInt(surgeAmount, 10);
    if (!amt || amt <= 0) {
      toast({ title: "Invalid amount", description: "Enter a surge amount greater than $0.", variant: "destructive" });
      return;
    }
    setAddingSurge(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/compensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_surge", surge_amount: amt, surge_note: surgeNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Surge failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: `+$${amt} surge added`, description: `New total: $${data.total_offer}` });
      setSurgeAmount("");
      setSurgeNote("");
      setShowSurgeForm(false);
      await loadOffer();
      onRefresh();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setAddingSurge(false);
    }
  }

  const hasSavedOffer = currentOffer && currentOffer.pay_status !== "draft" && currentOffer.total_offer > 0;
  const isOverrideRequested = currentOffer?.pay_status === "override_requested";
  const isManualReview = currentOffer?.is_manual_review ?? false;

  // Display: current offer OR preview
  const display = preview
    ? {
        base_pay:       preview.basePay,
        distance_bonus: preview.distanceBonus,
        same_day_bonus: preview.sameDayBonus,
        rush_bonus:     preview.rushBonus,
        surge_bonus:    preview.surgeBonus,
        total_offer:    preview.totalOffer,
        notes:          preview.notes,
        requiresOpsLead: preview.requiresOpsLead,
        isManualReview:  preview.isManualReview,
        isSameDay:       preview.isSameDay,
        isRush:          preview.isRush,
      }
    : currentOffer
    ? {
        base_pay:       currentOffer.base_pay,
        distance_bonus: currentOffer.distance_bonus,
        same_day_bonus: currentOffer.same_day_bonus,
        rush_bonus:     currentOffer.rush_bonus,
        surge_bonus:    currentOffer.surge_bonus,
        total_offer:    currentOffer.total_offer,
        notes:          [] as string[],
        requiresOpsLead: currentOffer.requires_ops_lead,
        isManualReview:  currentOffer.is_manual_review,
        isSameDay:       currentOffer.is_same_day,
        isRush:          currentOffer.is_rush,
      }
    : null;

  return (
    <Card
      id="rc-compensation-panel"
      data-testid="card-rc-compensation"
      className={`transition-all duration-300 ${
        pulse ? "ring-2 ring-amber-400 dark:ring-amber-500 shadow-lg shadow-amber-100 dark:shadow-amber-900/20" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-700 dark:text-green-400" />
            RideChecker Compensation
          </span>
          {currentOffer ? (
            statusBadge(currentOffer.pay_status)
          ) : (
            <Badge variant="outline" className="text-muted-foreground">No Offer Set</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading compensation data…
          </div>
        ) : loadError ? (
          <div className="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Compensation module unavailable
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  {loadError}
                </p>
              </div>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 pl-6">
              Assignment will still work — pay can be set via the <strong>Base Pay</strong> field in the Pay panel below, or via the Supabase admin panel.
            </p>
            <Button size="sm" variant="outline" onClick={loadOffer} className="h-7 text-xs ml-6">
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* ── Offer breakdown ──────────────────────────────────── */}
            {display ? (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                {preview && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
                    Preview (not yet saved)
                  </p>
                )}
                <div className="flex justify-between text-sm font-medium">
                  <span>Base Pay ({order.package ?? "standard"})</span>
                  <span>${display.base_pay}</span>
                </div>
                <LineItem label="Distance Bonus" amount={display.distance_bonus} highlight />
                <LineItem label="Same-Day Bonus" amount={display.same_day_bonus} highlight />
                <LineItem label="Rush Bonus (< 4 hrs)" amount={display.rush_bonus} highlight />
                <LineItem label="Surge / Manual Boost" amount={display.surge_bonus} highlight />

                <div className="border-t pt-2 mt-1 flex justify-between font-semibold text-sm">
                  <span>Total Offer</span>
                  <span className={display.isManualReview ? "text-muted-foreground" : "text-green-700 dark:text-green-400"}>
                    {display.isManualReview ? "Manual Review" : `$${display.total_offer}`}
                  </span>
                </div>

                {/* Flags */}
                {display.requiresOpsLead && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 pt-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Distance &gt; 40 mi — Ops Lead review required
                  </div>
                )}
                {display.isRush && (
                  <div className="flex items-center gap-1.5 text-xs text-orange-700 dark:text-orange-400 pt-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    Rush inspection (&lt; 4 hrs) — $15 rush bonus
                  </div>
                )}
                {display.isSameDay && !display.isRush && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 pt-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    Same-day inspection — $10 bonus
                  </div>
                )}
                {display.isManualReview && (
                  <div className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400 pt-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Exotic/Specialty — manual pricing required
                  </div>
                )}
                {display.notes.map((n, i) => (
                  <p key={i} className="text-xs text-muted-foreground pt-0.5">{n}</p>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No RideChecker offer has been saved yet.
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 pl-5">
                  Calculate and save an offer below before assigning a RideChecker.
                </p>
              </div>
            )}

            {/* ── Override requested banner ────────────────────────── */}
            {isOverrideRequested && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-semibold">Override Requested</p>
                  {currentOffer?.override_reason && (
                    <p>{currentOffer.override_reason}</p>
                  )}
                  {isLead && (
                    <p className="text-amber-600 dark:text-amber-400">Awaiting your approval below.</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Calculation inputs ───────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-xs">Estimated Distance (miles)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  max={500}
                  step={0.5}
                  placeholder="e.g. 12"
                  value={distanceMiles}
                  onChange={(e) => setDistanceMiles(e.target.value)}
                  className="h-8 text-sm"
                  data-testid="input-distance-miles"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCalculate}
                  disabled={calculating}
                  data-testid="button-calculate-offer"
                >
                  {calculating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calculator className="h-3 w-3" />}
                  <span className="ml-1.5">Calculate</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Package: <span className="font-medium">{order.package ?? "standard"}</span>
                {(order as any).seller_available_date && (
                  <> · Inspection: <span className="font-medium">{(order as any).seller_available_date}</span></>
                )}
              </p>
            </div>

            {/* ── Ops Lead manual base override ────────────────────── */}
            {isLead && (
              <div>
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setShowManualOverride(!showManualOverride)}
                  data-testid="button-toggle-manual-override"
                >
                  {showManualOverride ? "Hide" : "Set"} manual base pay
                </button>
                {showManualOverride && (
                  <div className="mt-2 flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      step={1}
                      placeholder="e.g. 65"
                      value={manualBase}
                      onChange={(e) => setManualBase(e.target.value)}
                      className="h-8 text-sm w-24"
                      data-testid="input-manual-base-pay"
                    />
                    <span className="text-xs text-muted-foreground">Overrides calculated base pay</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Action buttons ───────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">
              {/* Save Offer */}
              {(!hasSavedOffer || preview) && !isOverrideRequested && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  data-testid="button-save-offer"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3 w-3 mr-1.5" />}
                  Save Offer
                </Button>
              )}

              {/* Re-calculate saved offer */}
              {hasSavedOffer && !preview && !isOverrideRequested && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSave}
                  disabled={saving}
                  data-testid="button-recalculate-offer"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Calculator className="h-3 w-3 mr-1.5" />}
                  Recalculate &amp; Save
                </Button>
              )}

              {/* Request Override */}
              {!isOverrideRequested && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowOverrideForm(!showOverrideForm)}
                  data-testid="button-request-override"
                >
                  <ShieldAlert className="h-3 w-3 mr-1.5" />
                  Request Override
                </Button>
              )}

              {/* Approve / Reject Override (ops_lead only) */}
              {isLead && isOverrideRequested && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-700 hover:bg-green-800 text-white"
                    onClick={handleApproveOverride}
                    disabled={approvingOverride}
                    data-testid="button-approve-override"
                  >
                    {approvingOverride ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3 w-3 mr-1.5" />}
                    Approve Override
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                    onClick={handleRejectOverride}
                    disabled={rejectingOverride}
                    data-testid="button-reject-override"
                  >
                    {rejectingOverride ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <XCircle className="h-3 w-3 mr-1.5" />}
                    Reject
                  </Button>
                </>
              )}

              {/* Add Surge (ops_lead only) */}
              {isLead && hasSavedOffer && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSurgeForm(!showSurgeForm)}
                  data-testid="button-toggle-surge"
                >
                  <Zap className="h-3 w-3 mr-1.5 text-amber-500" />
                  Add Surge
                </Button>
              )}
            </div>

            {/* ── Override request form ────────────────────────────── */}
            {showOverrideForm && (
              <div className="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Request Compensation Override</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Use for exotic vehicles, exceptional circumstances, or manual pricing. An Ops Lead must approve.
                </p>
                <Textarea
                  placeholder="Reason for override (required)…"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="min-h-[64px] text-xs resize-none"
                  data-testid="textarea-override-reason"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleRequestOverride}
                    disabled={requestingOverride || !overrideReason.trim()}
                    data-testid="button-submit-override-request"
                  >
                    {requestingOverride ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                    Submit Request
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowOverrideForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* ── Surge form (ops_lead only) ───────────────────────── */}
            {showSurgeForm && isLead && (
              <div className="rounded-md border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">Add Surge / Manual Boost</p>
                <p className="text-xs text-orange-700 dark:text-orange-400">
                  Applied on top of saved offer. Use when no RideChecker accepts the standard offer.
                </p>
                <div className="flex gap-2 items-center">
                  <span className="text-sm">$</span>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    step={5}
                    placeholder="e.g. 10"
                    value={surgeAmount}
                    onChange={(e) => setSurgeAmount(e.target.value)}
                    className="h-8 text-sm w-24"
                    data-testid="input-surge-amount"
                  />
                </div>
                <Input
                  placeholder="Note (optional)…"
                  value={surgeNote}
                  onChange={(e) => setSurgeNote(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="input-surge-note"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddSurge}
                    disabled={addingSurge || !surgeAmount}
                    data-testid="button-submit-surge"
                  >
                    {addingSurge ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Zap className="h-3 w-3 mr-1.5" />}
                    Apply Surge
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSurgeForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* ── Assignment readiness indicator ───────────────────── */}
            <div className={`flex items-center gap-2 rounded-md p-2.5 text-xs font-medium ${
              hasSavedOffer && !isManualReview
                ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800"
                : "bg-muted/50 text-muted-foreground border border-dashed"
            }`}>
              {hasSavedOffer && !isManualReview ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  Offer saved — RideChecker assignment is unlocked.
                </>
              ) : isOverrideRequested ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  Override pending Ops Lead approval before assignment.
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Save an offer to unlock RideChecker assignment.
                </>
              )}
            </div>

            {/* ── History (collapsible) ────────────────────────────── */}
            {history.length > 1 && (
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" data-testid="toggle-compensation-history">
                  <History className="h-3 w-3" />
                  {historyOpen ? "Hide" : "Show"} history ({history.length} versions)
                  <ChevronDown className={`h-3 w-3 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-1.5">
                    {history.map((h) => (
                      <div
                        key={h.id}
                        className="flex justify-between items-center rounded bg-muted/40 px-2.5 py-1.5 text-xs"
                        data-testid={`history-offer-${h.version}`}
                      >
                        <span className="text-muted-foreground">v{h.version} · {h.package_type ?? "standard"}</span>
                        <span className="font-medium">{h.is_manual_review ? "Manual" : `$${h.total_offer}`}</span>
                        {statusBadge(h.pay_status)}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
