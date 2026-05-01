"use client";

import { useState, useEffect, useCallback } from "react";
import type { Order, RideCheckerPayout } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  Plus,
  Save,
  Loader2,
  CheckCircle2,
  MapPin,
  Zap,
  Gift,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRelative } from "@/lib/utils/format";

interface PayPanelProps {
  order: Order;
  onRefresh: () => void;
}

// ── Pay tier config ──────────────────────────────────────────
const DISTANCE_TIERS = [
  { id: "local",   label: "Local",   base: 45, desc: "< 15 mi" },
  { id: "mid",     label: "Mid",     base: 50, desc: "15–30 mi" },
  { id: "far",     label: "Far",     base: 55, desc: "> 30 mi" },
];

const URGENCY_TIERS = [
  { id: "standard",  label: "Standard",  bonus: 0,  desc: "Flexible" },
  { id: "urgent",    label: "Urgent",    bonus: 10, desc: "+$10" },
  { id: "same_day",  label: "Same-day",  bonus: 15, desc: "+$15" },
];

interface BonusLine {
  id: string;
  label: string;
  amount: number;
}

const BONUS_OPTIONS: BonusLine[] = [
  { id: "same_day", label: "Same-day bonus",          amount: 5  },
  { id: "quality",  label: "High-quality report",     amount: 10 },
  { id: "streak",   label: "5-job streak bonus",      amount: 15 },
];

function payoutStatusBadge(status: string) {
  switch (status) {
    case "approved": return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Approved</Badge>;
    case "paid":     return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
    case "cancelled":return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
    default:         return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
  }
}

export function PayPanel({ order, onRefresh }: PayPanelProps) {
  const { toast } = useToast();

  // Calculator state
  const [distance,   setDistance]  = useState("local");
  const [urgency,    setUrgency]   = useState("standard");
  const [bonuses,    setBonuses]   = useState<Set<string>>(new Set());
  const [boostInput, setBoostInput] = useState("0");

  // Save state
  const [saving,     setSaving]     = useState(false);

  // Payout state
  const [payout,     setPayout]     = useState<RideCheckerPayout | null>(null);
  const [payoutLoad, setPayoutLoad] = useState(false);
  const [creating,   setCreating]   = useState(false);

  // Load existing payout
  const loadPayout = useCallback(async () => {
    setPayoutLoad(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/payout`);
      if (res.ok) {
        const data = await res.json();
        setPayout(data.payout);
      }
    } catch { /* silent */ }
    finally { setPayoutLoad(false); }
  }, [order.id]);

  useEffect(() => { loadPayout(); }, [loadPayout]);

  // Seed from order fields if they exist
  useEffect(() => {
    if (order.boost_amount) setBoostInput(String(order.boost_amount));
  }, [order.boost_amount]);

  // ── Calculations ────────────────────────────────────────
  const distanceTier = DISTANCE_TIERS.find((t) => t.id === distance)!;
  const urgencyTier  = URGENCY_TIERS.find((t) => t.id === urgency)!;
  const boost        = parseInt(boostInput, 10) || 0;

  const bonusTotal   = BONUS_OPTIONS
    .filter((b) => bonuses.has(b.id))
    .reduce((sum, b) => sum + b.amount, 0);

  const basePay      = distanceTier.base + urgencyTier.bonus;
  const totalOffer   = basePay + boost + bonusTotal;

  const bonusBreakdown = Object.fromEntries(
    BONUS_OPTIONS.filter((b) => bonuses.has(b.id)).map((b) => [b.id, b.amount])
  );

  function toggleBonus(id: string) {
    setBonuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addBoost(amount: number) {
    setBoostInput(String(Math.max(0, boost + amount)));
  }

  // ── Save pay to order ────────────────────────────────────
  async function handleSavePay() {
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/pay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_pay: basePay, boost_amount: boost, current_offer: totalOffer }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Save failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Pay saved", description: `Base $${basePay} + boost $${boost} + bonuses $${bonusTotal} = $${totalOffer}` });
      onRefresh();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Create payout record ─────────────────────────────────
  async function handleCreatePayout() {
    if (!order.assigned_ridechecker_id) {
      toast({ title: "No RideChecker assigned", description: "Assign a RideChecker first", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_pay: basePay + boost,
          bonus:    bonusTotal,
          bonus_breakdown: Object.keys(bonusBreakdown).length > 0 ? bonusBreakdown : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Payout record created!", description: `$${totalOffer} — pending approval` });
      await loadPayout();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card data-testid="card-pay-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          RideChecker Pay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ── Distance tier ─────────────────────────────── */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            Distance
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {DISTANCE_TIERS.map((t) => (
              <button
                key={t.id}
                onClick={() => setDistance(t.id)}
                data-testid={`button-distance-${t.id}`}
                className={`rounded-md border px-2 py-2 text-center transition-all text-xs ${
                  distance === t.id
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                }`}
              >
                <div className="font-semibold">{t.label}</div>
                <div className="text-[10px] opacity-70">${t.base} · {t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Urgency tier ──────────────────────────────── */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            Urgency
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {URGENCY_TIERS.map((t) => (
              <button
                key={t.id}
                onClick={() => setUrgency(t.id)}
                data-testid={`button-urgency-${t.id}`}
                className={`rounded-md border px-2 py-2 text-center transition-all text-xs ${
                  urgency === t.id
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                }`}
              >
                <div className="font-semibold">{t.label}</div>
                <div className="text-[10px] opacity-70">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Boost ─────────────────────────────────────── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="boost-input" className="text-xs">Pay Boost ($)</Label>
            <div className="flex gap-1">
              {[5, 10, 25].map((amt) => (
                <button
                  key={amt}
                  onClick={() => addBoost(amt)}
                  data-testid={`button-boost-${amt}`}
                  className="flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-2.5 w-2.5" />+${amt}
                </button>
              ))}
            </div>
          </div>
          <Input
            id="boost-input"
            type="number"
            min={0}
            value={boostInput}
            onChange={(e) => setBoostInput(e.target.value)}
            className="h-8 text-sm"
            data-testid="input-boost-amount"
          />
        </div>

        {/* ── Bonuses ───────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <Gift className="h-3 w-3" />
            Incentive Bonuses
          </Label>
          <div className="space-y-1.5">
            {BONUS_OPTIONS.map((b) => (
              <label
                key={b.id}
                className="flex items-center gap-2.5 cursor-pointer group"
                data-testid={`bonus-${b.id}`}
              >
                <Checkbox
                  checked={bonuses.has(b.id)}
                  onCheckedChange={() => toggleBonus(b.id)}
                />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors flex-1">
                  {b.label}
                </span>
                <span className="text-xs font-semibold text-primary">+${b.amount}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Total summary ─────────────────────────────── */}
        <div className="rounded-md bg-muted/40 border px-3 py-2.5 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Base ({distanceTier.label} + {urgencyTier.label})</span>
            <span>${distanceTier.base} + ${urgencyTier.bonus}</span>
          </div>
          {boost > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Boost</span>
              <span>+${boost}</span>
            </div>
          )}
          {bonusTotal > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Bonuses</span>
              <span>+${bonusTotal}</span>
            </div>
          )}
          <Separator className="my-1" />
          <div className="flex justify-between font-bold">
            <span className="text-sm">Total Offer</span>
            <span className="text-lg text-primary">${totalOffer}</span>
          </div>
        </div>

        {/* ── Save pay ──────────────────────────────────── */}
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2"
          onClick={handleSavePay}
          disabled={saving}
          data-testid="button-save-pay"
        >
          {saving ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
          ) : (
            <><Save className="h-3.5 w-3.5" />Save to Order</>
          )}
        </Button>

        <Separator />

        {/* ── Payout record ─────────────────────────────── */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Payout Record</Label>

          {payoutLoad ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : payout ? (
            <div className="rounded-md border px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                {payoutStatusBadge(payout.status)}
                <span className="text-xs text-muted-foreground">{formatRelative(payout.created_at)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base + boost</span>
                <span className="font-medium">${payout.base_pay}</span>
              </div>
              {payout.bonus > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bonuses</span>
                  <span className="font-medium">+${payout.bonus}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t pt-1.5">
                <span>Total Pay</span>
                <span className="text-primary">${payout.total_pay}</span>
              </div>
              {payout.status === "paid" && payout.paid_at && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Paid {formatRelative(payout.paid_at)}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No payout record yet.</p>
          )}

          {(!payout || payout.status === "cancelled") && (
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={handleCreatePayout}
              disabled={creating || !order.assigned_ridechecker_id}
              data-testid="button-create-payout"
            >
              {creating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Creating…</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5" />Create Payout Record</>
              )}
            </Button>
          )}
          {!order.assigned_ridechecker_id && (
            <p className="text-xs text-muted-foreground text-center">
              Assign a RideChecker to create a payout
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
