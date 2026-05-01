"use client";

import { useState, useEffect } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Plus, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PayPanelProps {
  order: Order;
  onRefresh: () => void;
}

export function PayPanel({ order, onRefresh }: PayPanelProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [basePay,      setBasePay]      = useState(String(order.base_pay      ?? 0));
  const [boostAmount,  setBoostAmount]  = useState(String(order.boost_amount  ?? 0));

  useEffect(() => {
    setBasePay(String(order.base_pay ?? 0));
    setBoostAmount(String(order.boost_amount ?? 0));
  }, [order.base_pay, order.boost_amount]);

  const computed = (parseInt(basePay, 10) || 0) + (parseInt(boostAmount, 10) || 0);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/pay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_pay:      parseInt(basePay, 10)     || 0,
          boost_amount:  parseInt(boostAmount, 10) || 0,
          current_offer: computed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed to save pay", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Pay updated", description: `Current offer: $${computed}` });
      onRefresh();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleBoost(amount: number) {
    const current = parseInt(boostAmount, 10) || 0;
    const next = String(current + amount);
    setBoostAmount(next);
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="base-pay" className="text-xs">Base Pay ($)</Label>
            <Input
              id="base-pay"
              type="number"
              min={0}
              value={basePay}
              onChange={(e) => setBasePay(e.target.value)}
              className="h-8 text-sm"
              data-testid="input-base-pay"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="boost-amount" className="text-xs">Boost ($)</Label>
            <Input
              id="boost-amount"
              type="number"
              min={0}
              value={boostAmount}
              onChange={(e) => setBoostAmount(e.target.value)}
              className="h-8 text-sm"
              data-testid="input-boost-amount"
            />
          </div>
        </div>

        <div className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2">
          <span className="text-xs text-muted-foreground">Current offer</span>
          <span className="font-bold text-base text-primary">${computed}</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[5, 10, 25].map((amt) => (
            <Button
              key={amt}
              variant="outline"
              size="sm"
              onClick={() => handleBoost(amt)}
              className="text-xs h-7 px-2.5"
              data-testid={`button-boost-${amt}`}
            >
              <Plus className="h-3 w-3 mr-1" />
              +${amt}
            </Button>
          ))}
        </div>

        <Button
          size="sm"
          className="w-full gap-2"
          onClick={handleSave}
          disabled={saving}
          data-testid="button-save-pay"
        >
          {saving ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
          ) : (
            <><Save className="h-3.5 w-3.5" />Save Pay</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
