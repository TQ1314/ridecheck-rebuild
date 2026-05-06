"use client";

import { useState, useEffect } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RiskFlagsPanelProps {
  order: Order;
  onRefresh: () => void;
}

const FLAG_DEFINITIONS: { key: string; label: string; severity: "high" | "medium" | "low" }[] = [
  { key: "vin_mismatch",           label: "VIN mismatch (listing vs. vehicle)",        severity: "high"   },
  { key: "different_car",          label: "Different car than listing photos",           severity: "high"   },
  { key: "title_concerns",         label: "Title issues / salvage / rebuilt",            severity: "high"   },
  { key: "seller_rushing",         label: "Seller rushing or pressuring buyer",          severity: "high"   },
  { key: "no_seller_id",           label: "Seller refuses to verify identity",           severity: "high"   },
  { key: "price_too_low",          label: "Price suspiciously below market",             severity: "medium" },
  { key: "odometer_suspect",       label: "Odometer reading suspect / inconsistent",     severity: "medium" },
  { key: "multiple_listings",      label: "Same vehicle listed in multiple locations",   severity: "medium" },
  { key: "structural_damage",      label: "Structural damage not disclosed in listing",  severity: "medium" },
  { key: "payment_method_odd",     label: "Unusual payment method requested",            severity: "medium" },
  { key: "seller_out_of_state",    label: "Seller or vehicle out of stated location",    severity: "low"    },
  { key: "recent_owner_change",    label: "Recent ownership change (< 30 days)",         severity: "low"    },
  { key: "missing_service_records",label: "No service records available",                severity: "low"    },
];

const SEVERITY_STYLES: Record<string, string> = {
  high:   "text-red-700 bg-red-50 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
  medium: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  low:    "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
};

export function RiskFlagsPanel({ order, onRefresh }: RiskFlagsPanelProps) {
  const { toast } = useToast();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    const stored = order.risk_flags ?? {};
    for (const def of FLAG_DEFINITIONS) {
      initial[def.key] = !!stored[def.key];
    }
    setFlags(initial);
    setDirty(false);
  }, [order.risk_flags]);

  function toggle(key: string) {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/risk-flags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ risk_flags: flags }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Failed to save flags", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Risk flags saved" });
      setDirty(false);
      onRefresh();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const activeFlags = FLAG_DEFINITIONS.filter((d) => flags[d.key]);
  const highCount = activeFlags.filter((d) => d.severity === "high").length;
  const mediumCount = activeFlags.filter((d) => d.severity === "medium").length;

  return (
    <Card data-testid="card-risk-flags">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {activeFlags.length > 0 ? (
            <ShieldAlert className="h-4 w-4 text-red-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-green-600" />
          )}
          Risk Flags
          {activeFlags.length > 0 && (
            <span className="ml-auto flex gap-1">
              {highCount > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0" data-testid="badge-high-flags">
                  {highCount} high
                </Badge>
              )}
              {mediumCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0" data-testid="badge-medium-flags">
                  {mediumCount} med
                </Badge>
              )}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeFlags.length === 0 && !dirty && (
          <p className="text-xs text-muted-foreground">No flags raised. Check any that apply.</p>
        )}

        <div className="space-y-1">
          {FLAG_DEFINITIONS.map((def) => {
            const active = flags[def.key];
            return (
              <label
                key={def.key}
                className={`flex items-start gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                  active
                    ? SEVERITY_STYLES[def.severity]
                    : "hover:bg-muted/60 text-muted-foreground"
                }`}
                data-testid={`flag-${def.key}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 accent-red-600 cursor-pointer shrink-0"
                  checked={active}
                  onChange={() => toggle(def.key)}
                  data-testid={`checkbox-flag-${def.key}`}
                />
                <span className="text-xs leading-snug">{def.label}</span>
                {active && (
                  <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                    def.severity === "high" ? "text-red-600" :
                    def.severity === "medium" ? "text-amber-600" : "text-blue-600"
                  }`}>
                    {def.severity}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {dirty && (
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={handleSave}
            disabled={saving}
            data-testid="button-save-risk-flags"
          >
            {saving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
            ) : (
              "Save Flags"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
