"use client";

import { useEffect, useState, useCallback } from "react";
import type { RideCheckerPayout, RideCheckerPayoutBatch } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Wallet,
  CheckCircle2,
  DollarSign,
  Clock,
  Loader2,
  Layers,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { formatRelative } from "@/lib/utils/format";

type PayoutStatus = "pending" | "approved" | "paid" | "cancelled" | "all";

interface PayoutSummary {
  pending:       number;
  approved:      number;
  pending_count: number;
  approved_count: number;
}

function statusBadge(status: string) {
  switch (status) {
    case "approved": return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Approved</Badge>;
    case "paid":     return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Paid</Badge>;
    case "cancelled":return <Badge variant="outline" className="text-xs text-muted-foreground">Cancelled</Badge>;
    default:         return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">Pending</Badge>;
  }
}

function batchStatusBadge(status: string) {
  switch (status) {
    case "completed": return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Completed</Badge>;
    case "processing":return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Processing</Badge>;
    case "cancelled": return <Badge variant="outline" className="text-xs text-muted-foreground">Cancelled</Badge>;
    default:          return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">Pending</Badge>;
  }
}

export default function OpsPayoutsPage() {
  const { toast } = useToast();

  const [payouts,    setPayouts]    = useState<RideCheckerPayout[]>([]);
  const [summary,    setSummary]    = useState<PayoutSummary | null>(null);
  const [batches,    setBatches]    = useState<RideCheckerPayoutBatch[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<PayoutStatus>("pending");

  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [actioning,  setActioning]  = useState<string | null>(null);
  const [batching,   setBatching]   = useState(false);
  const [batchName,  setBatchName]  = useState("");
  const [batchOpen,  setBatchOpen]  = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const [payoutsRes, batchesRes] = await Promise.all([
        fetch("/api/ops/payouts"),
        fetch("/api/ops/payout-batches"),
      ]);
      if (payoutsRes.ok) {
        const data = await payoutsRes.json();
        setPayouts(data.payouts ?? []);
        setSummary(data.summary ?? null);
      }
      if (batchesRes.ok) {
        const data = await batchesRes.json();
        setBatches(data.batches ?? []);
      }
    } catch {
      toast({ title: "Failed to load payouts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAction(payoutId: string, action: "approve" | "mark_paid" | "cancel") {
    setActioning(payoutId);
    try {
      const res = await fetch(`/api/ops/payouts/${payoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Action failed", description: data.error, variant: "destructive" });
        return;
      }
      const labels: Record<string, string> = {
        approve: "Payout approved",
        mark_paid: "Marked as paid",
        cancel: "Payout cancelled",
      };
      toast({ title: labels[action] });
      await loadData();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setActioning(null);
    }
  }

  async function handleCreateBatch() {
    if (selected.size === 0) return;
    setBatching(true);
    try {
      const res = await fetch("/api/ops/payout-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payout_ids: Array.from(selected),
          batch_name: batchName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Batch failed",
          description: typeof data.error === "string" ? data.error : "Only approved payouts can be batched",
          variant: "destructive",
        });
        return;
      }
      toast({ title: `Batch created — $${data.batch.total_amount} · ${data.batch.payout_count} payouts` });
      setBatchOpen(false);
      setBatchName("");
      await loadData();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setBatching(false);
    }
  }

  async function handleBatchAction(batchId: string, action: "mark_completed" | "cancel") {
    setActioning(batchId);
    try {
      const res = await fetch(`/api/ops/payout-batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        toast({ title: "Action failed", variant: "destructive" });
        return;
      }
      toast({ title: action === "mark_completed" ? "Batch marked complete — payouts paid" : "Batch cancelled" });
      await loadData();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setActioning(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    if (ids.every((id) => selected.has(id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...ids]));
    }
  }

  // Filter payouts by tab
  const filtered = activeTab === "all"
    ? payouts
    : payouts.filter((p) => p.status === activeTab);

  const pendingPayouts   = payouts.filter((p) => p.status === "pending");
  const approvedPayouts  = payouts.filter((p) => p.status === "approved");
  const paidPayouts      = payouts.filter((p) => p.status === "paid");

  const countsByTab: Record<PayoutStatus, number> = {
    pending:  pendingPayouts.length,
    approved: approvedPayouts.length,
    paid:     paidPayouts.length,
    all:      payouts.length,
    cancelled: 0,
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Payout Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track, approve, and batch RideChecker payouts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">Pending</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">
              ${summary?.pending ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">{summary?.pending_count ?? 0} payouts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="text-xs">Approved</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              ${summary?.approved ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">{summary?.approved_count ?? 0} ready to pay</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-xs">Total Paid</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              ${paidPayouts.reduce((s, p) => s + p.total_pay, 0)}
            </div>
            <p className="text-xs text-muted-foreground">{paidPayouts.length} payouts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Layers className="h-3.5 w-3.5" />
              <span className="text-xs">Batches</span>
            </div>
            <div className="text-2xl font-bold">{batches.length}</div>
            <p className="text-xs text-muted-foreground">
              {batches.filter((b) => b.status === "pending").length} pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as PayoutStatus); setSelected(new Set()); }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="h-9">
            <TabsTrigger value="pending" className="text-xs">
              Pending {pendingPayouts.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{pendingPayouts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">
              Approved {approvedPayouts.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{approvedPayouts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="paid"    className="text-xs">Paid</TabsTrigger>
            <TabsTrigger value="all"     className="text-xs">All</TabsTrigger>
          </TabsList>

          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 h-8" data-testid="button-create-batch">
                    <Layers className="h-3.5 w-3.5" />
                    Create Batch
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Create Payout Batch</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="bg-muted/40 rounded-md px-3 py-2.5 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payouts selected</span>
                        <span className="font-medium">{selected.size}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total amount</span>
                        <span className="font-bold text-primary">
                          ${payouts.filter((p) => selected.has(p.id)).reduce((s, p) => s + p.total_pay, 0)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="batch-name" className="text-xs">Batch name (optional)</Label>
                      <Input
                        id="batch-name"
                        value={batchName}
                        onChange={(e) => setBatchName(e.target.value)}
                        placeholder="e.g. May 1 Payouts"
                        className="h-8 text-sm"
                        data-testid="input-batch-name"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Only approved payouts can be batched
                    </div>
                    <Button
                      className="w-full gap-2"
                      onClick={handleCreateBatch}
                      disabled={batching}
                      data-testid="button-confirm-batch"
                    >
                      {batching ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Creating…</>
                      ) : (
                        <><Layers className="h-3.5 w-3.5" />Create Batch</>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Payouts table */}
        {(["pending", "approved", "paid", "all"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No {tab === "all" ? "" : tab} payouts</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <Checkbox
                          checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                          onCheckedChange={() => toggleSelectAll(filtered.map((p) => p.id))}
                          data-testid="checkbox-select-all"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">RideChecker</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Vehicle</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Base</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">Bonus</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Created</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        className={`hover:bg-muted/30 transition-colors ${selected.has(p.id) ? "bg-primary/5" : ""}`}
                        data-testid={`row-payout-${p.id}`}
                      >
                        <td className="px-3 py-2.5">
                          <Checkbox
                            checked={selected.has(p.id)}
                            onCheckedChange={() => toggleSelect(p.id)}
                            data-testid={`checkbox-payout-${p.id}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div>
                            <p className="font-medium text-xs">{p.ridechecker_name ?? "—"}</p>
                            {p.ridechecker_email && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{p.ridechecker_email}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <Link
                            href={`/operations/orders/${p.order_id}`}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                            data-testid={`link-order-${p.order_id}`}
                          >
                            {p.vehicle_label || p.order_id.slice(0, 8).toUpperCase()}
                            <ArrowRight className="h-3 w-3 opacity-60" />
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">${p.base_pay}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs hidden md:table-cell">
                          {p.bonus > 0 ? <span className="text-green-600">+${p.bonus}</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-primary">${p.total_pay}</td>
                        <td className="px-3 py-2.5 text-center">{statusBadge(p.status)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                          {formatRelative(p.created_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs"
                                onClick={() => handleAction(p.id, "approve")}
                                disabled={actioning === p.id}
                                data-testid={`button-approve-${p.id}`}
                              >
                                {actioning === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                              </Button>
                            )}
                            {p.status === "approved" && !p.payout_batch_id && (
                              <Button
                                size="sm"
                                className="h-7 px-2.5 text-xs gap-1"
                                onClick={() => handleAction(p.id, "mark_paid")}
                                disabled={actioning === p.id}
                                data-testid={`button-mark-paid-${p.id}`}
                              >
                                {actioning === p.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <><CheckCircle2 className="h-3 w-3" />Mark Paid</>
                                )}
                              </Button>
                            )}
                            {p.status === "approved" && p.payout_batch_id && (
                              <span className="text-xs text-muted-foreground">In batch</span>
                            )}
                            {p.status === "paid" && (
                              <div className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                {p.paid_at ? formatRelative(p.paid_at) : "Paid"}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Payout Batches */}
      {batches.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Payout Batches
          </h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Batch</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Payouts</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Created</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-batch-${b.id}`}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-xs">{b.batch_name || b.id.slice(0, 8).toUpperCase()}</p>
                      {b.notes && <p className="text-[11px] text-muted-foreground">{b.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">{b.payout_count}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-primary">${b.total_amount}</td>
                    <td className="px-3 py-2.5 text-center">{batchStatusBadge(b.status)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                      {formatRelative(b.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {b.status === "pending" && (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1"
                            onClick={() => handleBatchAction(b.id, "mark_completed")}
                            disabled={actioning === b.id}
                            data-testid={`button-complete-batch-${b.id}`}
                          >
                            {actioning === b.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <><CheckCircle2 className="h-3 w-3" />Mark All Paid</>
                            )}
                          </Button>
                        )}
                        {b.status === "completed" && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {b.processed_at ? formatRelative(b.processed_at) : "Done"}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
