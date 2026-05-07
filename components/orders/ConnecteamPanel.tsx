"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@/types/orders";
import { formatRelative } from "@/lib/utils/format";
import {
  ClipboardCopy,
  CheckCircle2,
  RotateCcw,
  ExternalLink,
  Bell,
  Users,
  Loader2,
} from "lucide-react";

interface ConnecteamLog {
  id: string;
  action: string;
  notes: string | null;
  created_at: string;
}

interface ConnecteamMapping {
  connecteam_name: string | null;
  connecteam_status: string;
}

interface ConnecteamPanelProps {
  order: Order;
  onRefresh: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  ridechecker_notified: "RC Notified in Connecteam",
  task_created: "Task Created in Connecteam",
  task_reassigned: "Task Reassigned",
  escalation_sent: "Escalation Sent",
  inspection_completed_notice: "Inspection Complete Notice",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, " ");
}

function generateTaskTemplate(order: Order, rcName?: string | null): string {
  const vehicle =
    [order.vehicle_year, order.vehicle_make, order.vehicle_model]
      .filter(Boolean)
      .join(" ") || "—";

  const rawDate = order.scheduled_date || order.preferred_date;
  const dateStr = rawDate
    ? new Date(rawDate).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBD — confirm with ops";

  const location =
    order.inspection_address ||
    (order as any).inspection_location ||
    order.vehicle_location ||
    "See order for location";

  const sellerName = order.seller_name || "—";
  const sellerPhone = order.seller_phone || "—";
  const sellerEmail = (order as any).seller_email || null;
  const sourceParts = [order.listing_source, order.platform_source].filter(Boolean);
  const source = sourceParts.length > 0 ? sourceParts.join(" / ") : "—";
  const listingUrl = order.listing_url || null;

  const orderRef = order.id.slice(0, 8).toUpperCase();
  const orderUrl = `https://www.ridecheckauto.com/operations/orders/${order.id}`;
  const assignedRc = rcName || "See RideCheck dashboard";

  return `=== RIDECHECK INSPECTION TASK ===

ORDER REF: ${orderRef}
VEHICLE:   ${vehicle}
LOCATION:  ${location}
DATE:      ${dateStr}

── SELLER CONTACT ──────────────────
Name:   ${sellerName}
Phone:  ${sellerPhone}${sellerEmail ? `\nEmail:  ${sellerEmail}` : ""}
Source: ${source}${listingUrl ? `\nListing: ${listingUrl}` : ""}

── ASSIGNED RIDECHECKER ────────────
${assignedRc}

── INSPECTION CHECKLIST REMINDERS ──
✅ Complete ALL checklist sections fully
✅ Photograph every major area (exterior, interior, engine, under-chassis, trunk)
✅ Record the exact odometer reading
✅ Verify VIN on dash and door jamb against the listing
✅ Note any missing, replaced, or aftermarket parts
✅ Flag any fluid leaks, rust, or structural concerns
✅ Submit photos and findings in RideCheck app before leaving

── SAFETY REMINDERS ────────────────
⚠️  Meet at a public, well-lit location
⚠️  Do not drive or transport the vehicle
⚠️  Never accept or handle money on behalf of the buyer
⚠️  If the seller is hostile or the situation feels unsafe, leave immediately and notify ops

── OPS REFERENCE (internal only) ───
${orderUrl}

=================================`;
}

export function ConnecteamPanel({ order, onRefresh }: ConnecteamPanelProps) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ConnecteamLog[]>([]);
  const [mapping, setMapping] = useState<ConnecteamMapping | null>(null);
  const [rcName, setRcName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/connecteam`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setMapping(data.rc_mapping || null);
        setRcName(data.rc_name || null);
      }
    } finally {
      setLoading(false);
    }
  }, [order.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logAction = async (action: string, notes?: string) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/connecteam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: actionLabel(action), description: "Logged successfully" });
      loadData();
    } finally {
      setActionLoading(null);
    }
  };

  const copyTask = async () => {
    const text = generateTaskTemplate(order, rcName);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Task copied to clipboard", description: "Paste directly into Connecteam" });
      await logAction("task_created", "Task template copied to clipboard");
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually", variant: "destructive" });
    }
  };

  const lastLog = logs[0];
  const busy = !!actionLoading;

  return (
    <Card data-testid="card-connecteam-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Internal Communication
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 ml-auto no-default-hover-elevate no-default-active-elevate"
          >
            Connecteam
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Assigned RC</p>
            <p className="font-medium text-sm">
              {rcName || (order as any).assigned_ridechecker_name || "Unassigned"}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Connecteam Status</p>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : mapping ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant={mapping.connecteam_status === "active" ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate"
                >
                  {mapping.connecteam_status === "active" ? "In Connecteam" : "Inactive"}
                </Badge>
                {mapping.connecteam_name && (
                  <span className="text-xs text-muted-foreground">{mapping.connecteam_name}</span>
                )}
              </div>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate text-muted-foreground"
              >
                Not mapped
              </Badge>
            )}
          </div>

          <div className="col-span-2">
            <p className="text-xs text-muted-foreground mb-0.5">Last Internal Communication</p>
            <p className="text-xs font-medium">
              {lastLog
                ? `${actionLabel(lastLog.action)} — ${formatRelative(lastLog.created_at)}`
                : "No activity logged yet"}
            </p>
          </div>
        </div>

        {/* Log history */}
        {logs.length > 0 && (
          <div className="space-y-1 max-h-28 overflow-y-auto border rounded p-2 bg-muted/20">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-xs gap-2"
                data-testid={`connecteam-log-${log.id}`}
              >
                <span className="text-muted-foreground truncate">{actionLabel(log.action)}</span>
                <span className="text-muted-foreground flex-shrink-0">
                  {formatRelative(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="col-span-2 text-xs"
            onClick={copyTask}
            disabled={busy}
            data-testid="button-copy-connecteam-task"
          >
            <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" />
            Copy Connecteam Task
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => logAction("ridechecker_notified")}
            disabled={busy}
            data-testid="button-mark-rc-notified"
          >
            {actionLoading === "ridechecker_notified" ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Bell className="h-3.5 w-3.5 mr-1.5" />
            )}
            RC Notified
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => logAction("task_created")}
            disabled={busy}
            data-testid="button-mark-task-created"
          >
            {actionLoading === "task_created" ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Task Created
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => logAction("task_reassigned")}
            disabled={busy}
            data-testid="button-mark-reassigned"
          >
            {actionLoading === "task_reassigned" ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Mark Reassigned
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            asChild
            data-testid="button-open-connecteam"
          >
            <a href="https://app.connecteam.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Open Connecteam
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
