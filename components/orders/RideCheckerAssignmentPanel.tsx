"use client";

import { useState, useEffect, useCallback } from "react";
import type { Order, JobBroadcast } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  UserCheck,
  Radio,
  Loader2,
  Star,
  Briefcase,
  ChevronDown,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRelative } from "@/lib/utils/format";

interface RideCheckerSuggestion {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  service_area: string | null;
  rating: number;
  active_jobs: number;
  max_daily_jobs: number;
  score: number;
}

interface RideCheckerAssignmentPanelProps {
  order: Order;
  onRefresh: () => void;
}

function assignmentBadge(status: string | undefined) {
  switch (status) {
    case "assigned":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Assigned</Badge>;
    case "accepted":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Accepted</Badge>;
    case "en_route":
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200">En Route</Badge>;
    case "completed":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
    default:
      return <Badge variant="outline">Unassigned</Badge>;
  }
}

function broadcastStatusIcon(status: string) {
  switch (status) {
    case "accepted":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    case "declined":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "expired":
      return <AlertTriangle className="h-3.5 w-3.5 text-gray-400" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-yellow-500" />;
  }
}

function broadcastStatusLabel(status: string) {
  switch (status) {
    case "accepted":  return "Accepted";
    case "declined":  return "Declined";
    case "expired":   return "Expired";
    default:          return "Sent";
  }
}

export function RideCheckerAssignmentPanel({ order, onRefresh }: RideCheckerAssignmentPanelProps) {
  const { toast } = useToast();

  const [ridecheckers, setRidecheckers] = useState<RideCheckerSuggestion[]>([]);
  const [rcLoading, setRcLoading] = useState(false);

  const [selectedDirect, setSelectedDirect] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [selectedBroadcast, setSelectedBroadcast] = useState<Set<string>>(new Set());
  const [broadcastPay, setBroadcastPay] = useState<string>(
    String(order.current_offer ?? order.base_pay ?? 0)
  );
  const [broadcasting, setBroadcasting] = useState(false);

  const [broadcasts, setBroadcasts] = useState<JobBroadcast[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadRidecheckers = useCallback(async () => {
    setRcLoading(true);
    try {
      const res = await fetch("/api/admin/ridecheckers/suggest");
      if (res.ok) {
        const data = await res.json();
        setRidecheckers(data.suggestions ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setRcLoading(false);
    }
  }, []);

  const loadBroadcasts = useCallback(async () => {
    setBLoading(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/broadcast`);
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data.broadcasts ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setBLoading(false);
    }
  }, [order.id]);

  useEffect(() => {
    loadRidecheckers();
    loadBroadcasts();
  }, [loadRidecheckers, loadBroadcasts]);

  async function handleDirectAssign() {
    if (!selectedDirect) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/ridechecker-assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ridechecker_id: selectedDirect }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Assignment failed", description: data.error, variant: "destructive" });
        return;
      }
      const rc = ridecheckers.find((r) => r.id === selectedDirect);
      toast({ title: "RideChecker assigned", description: rc?.full_name });
      setSelectedDirect("");
      onRefresh();
      loadBroadcasts();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemoveAssignment() {
    setRemoving(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/ridechecker-assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ridechecker_id: null }),
      });
      if (!res.ok) {
        toast({ title: "Failed to remove assignment", variant: "destructive" });
        return;
      }
      toast({ title: "Assignment removed" });
      onRefresh();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  }

  function toggleBroadcastSelect(id: string) {
    setSelectedBroadcast((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedBroadcast.size === ridecheckers.length) {
      setSelectedBroadcast(new Set());
    } else {
      setSelectedBroadcast(new Set(ridecheckers.map((r) => r.id)));
    }
  }

  async function handleBroadcast() {
    if (selectedBroadcast.size === 0) {
      toast({ title: "Select at least one RideChecker", variant: "destructive" });
      return;
    }
    const pay = parseInt(broadcastPay, 10);
    if (isNaN(pay) || pay < 0) {
      toast({ title: "Enter a valid offered pay", variant: "destructive" });
      return;
    }
    setBroadcasting(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ridechecker_ids: Array.from(selectedBroadcast),
          offered_pay: pay,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Broadcast failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Broadcast sent!",
        description: `Notified ${data.sent_to} RideChecker${data.sent_to === 1 ? "" : "s"} ($${pay} offered)`,
      });
      setSelectedBroadcast(new Set());
      onRefresh();
      loadBroadcasts();
      setHistoryOpen(true);
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setBroadcasting(false);
    }
  }

  const currentRc = order.assigned_ridechecker_id
    ? ridecheckers.find((r) => r.id === order.assigned_ridechecker_id)
    : null;

  const openBroadcasts = broadcasts.filter((b) => b.status === "sent");
  const hasHistory = broadcasts.length > 0;

  return (
    <Card data-testid="card-ridechecker-assignment">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            RideChecker Assignment
          </span>
          {assignmentBadge(order.assignment_status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current assignment */}
        {order.assigned_ridechecker_id && (
          <div className="flex items-center justify-between gap-2 bg-muted/40 rounded-md px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">
                {currentRc?.full_name ?? "Assigned RideChecker"}
              </p>
              {currentRc?.email && (
                <p className="text-xs text-muted-foreground truncate">{currentRc.email}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-destructive shrink-0"
              onClick={handleRemoveAssignment}
              disabled={removing}
              data-testid="button-remove-assignment"
            >
              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </Button>
          </div>
        )}

        {/* Direct assign */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Direct Assign</Label>
          <div className="flex gap-2">
            <Select
              value={selectedDirect}
              onValueChange={setSelectedDirect}
              disabled={rcLoading}
            >
              <SelectTrigger
                className="h-8 text-xs flex-1 min-w-0"
                data-testid="select-ridechecker-direct"
              >
                <SelectValue placeholder={rcLoading ? "Loading…" : "Pick a RideChecker"} />
              </SelectTrigger>
              <SelectContent>
                {ridecheckers.map((rc) => (
                  <SelectItem key={rc.id} value={rc.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{rc.full_name}</span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Star className="h-2.5 w-2.5" />
                        {rc.rating.toFixed(1)}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Briefcase className="h-2.5 w-2.5" />
                        {rc.active_jobs}
                      </span>
                    </span>
                  </SelectItem>
                ))}
                {!rcLoading && ridecheckers.length === 0 && (
                  <SelectItem value="__none__" disabled>No active RideCheckers</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              onClick={handleDirectAssign}
              disabled={assigning || !selectedDirect}
              data-testid="button-direct-assign"
            >
              {assigning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
              Assign
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or broadcast</span>
          </div>
        </div>

        {/* Broadcast */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Broadcast to RideCheckers</Label>
            {ridecheckers.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="text-xs text-primary hover:underline"
                data-testid="button-select-all-broadcast"
              >
                {selectedBroadcast.size === ridecheckers.length ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>

          <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
            {rcLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : ridecheckers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No active RideCheckers</p>
            ) : (
              ridecheckers.map((rc) => (
                <label
                  key={rc.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                  data-testid={`item-broadcast-rc-${rc.id}`}
                >
                  <Checkbox
                    checked={selectedBroadcast.has(rc.id)}
                    onCheckedChange={() => toggleBroadcastSelect(rc.id)}
                    data-testid={`checkbox-broadcast-${rc.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{rc.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {rc.service_area || rc.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5" />
                      {rc.rating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Briefcase className="h-2.5 w-2.5" />
                      {rc.active_jobs}/{rc.max_daily_jobs}
                    </span>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="broadcast-pay" className="text-xs">Offered Pay ($)</Label>
              <Input
                id="broadcast-pay"
                type="number"
                min={0}
                value={broadcastPay}
                onChange={(e) => setBroadcastPay(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-broadcast-pay"
              />
            </div>
            <Button
              size="sm"
              className="h-8 gap-1.5 shrink-0"
              onClick={handleBroadcast}
              disabled={broadcasting || selectedBroadcast.size === 0}
              data-testid="button-broadcast"
            >
              {broadcasting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Radio className="h-3.5 w-3.5" />
              )}
              Broadcast
              {selectedBroadcast.size > 0 && (
                <span className="ml-0.5 bg-white/20 rounded px-1 text-xs">
                  {selectedBroadcast.size}
                </span>
              )}
            </Button>
          </div>

          {openBroadcasts.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded px-2 py-1.5">
              <Send className="h-3.5 w-3.5 shrink-0" />
              <span>{openBroadcasts.length} pending broadcast{openBroadcasts.length > 1 ? "s" : ""} awaiting response</span>
            </div>
          )}
        </div>

        {/* Broadcast history */}
        {hasHistory && (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full pt-1"
                data-testid="button-toggle-broadcast-history"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`}
                />
                Broadcast history ({broadcasts.length})
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              {bLoading ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
                  {broadcasts.map((b) => (
                    <div key={b.id} className="flex items-center gap-2 px-3 py-2">
                      {broadcastStatusIcon(b.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {b.ridechecker_name ?? b.ridechecker_id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {broadcastStatusLabel(b.status)} · ${b.offered_pay}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatRelative(b.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
