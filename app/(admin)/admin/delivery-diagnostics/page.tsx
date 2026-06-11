"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  Search,
  Copy,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Mail,
  MessageSquare,
  MailCheck,
  ExternalLink,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRelative, formatDateTime } from "@/lib/utils/format";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DiagnosticsAttempt {
  id: string;
  order_id: string;
  attempt_number: number;
  channel: string;
  destination: string | null;
  message_template_key: string | null;
  message_body: string | null;
  status: string;
  created_at: string;
  provider_message_id: string | null;
  delivery_status: string | null;
  delivery_updated_at: string | null;
  is_auto_notification: boolean;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  latency_seconds: number | null;
}

interface DiagnosticsStats {
  total: number;
  delivered: number;
  queued: number;
  sent: number;
  bounced: number;
  failed: number;
  undeliverable: number;
  by_channel: { email: number; sms: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────────────────────────────────────

function DeliveryStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900 dark:text-gray-500 dark:border-gray-700">
        Not Tracked
      </span>
    );
  }

  const config: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    queued: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "Queued",
      cls: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
    },
    sent: {
      icon: <Send className="h-3 w-3" />,
      label: "Sent",
      cls: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700",
    },
    delivered: {
      icon: <CheckCircle className="h-3 w-3" />,
      label: "Delivered",
      cls: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-700",
    },
    bounced: {
      icon: <AlertCircle className="h-3 w-3" />,
      label: "Bounced",
      cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700",
    },
    failed: {
      icon: <XCircle className="h-3 w-3" />,
      label: "Failed",
      cls: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700",
    },
    undeliverable: {
      icon: <XCircle className="h-3 w-3" />,
      label: "Undeliverable",
      cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700",
    },
  };

  const c = config[status] ?? config.sent;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border ${c.cls}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "email") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
        <Mail className="h-3 w-3" />
        Email
      </span>
    );
  }
  if (channel === "sms") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 dark:text-teal-300">
        <MessageSquare className="h-3 w-3" />
        SMS
      </span>
    );
  }
  return <span className="text-[11px] text-muted-foreground capitalize">{channel}</span>;
}

function formatLatency(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function StatCard({
  title,
  value,
  sub,
  color,
  icon,
}: {
  title: string;
  value: number;
  sub?: string;
  color: "gray" | "green" | "blue" | "amber" | "red";
  icon: React.ReactNode;
}) {
  const colors = {
    gray:  "text-gray-600  dark:text-gray-400",
    green: "text-green-600 dark:text-green-400",
    blue:  "text-blue-600  dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    red:   "text-red-600   dark:text-red-400",
  };
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <p className="text-xs text-muted-foreground">{title}</p>
          <span className={colors[color]}>{icon}</span>
        </div>
        <p className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value.toLocaleString()}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const LIMIT = 50;
const RESENDABLE = new Set(["failed", "bounced", "undeliverable"]);

export default function DeliveryDiagnosticsPage() {
  const { toast } = useToast();
  const [attempts, setAttempts]             = useState<DiagnosticsAttempt[]>([]);
  const [stats, setStats]                   = useState<DiagnosticsStats | null>(null);
  const [loading, setLoading]               = useState(true);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [total, setTotal]                   = useState(0);
  const [offset, setOffset]                 = useState(0);
  const [channelFilter, setChannelFilter]   = useState("all");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [tracked, setTracked]               = useState("tracked");
  const [search, setSearch]                 = useState("");
  const [searchInput, setSearchInput]       = useState("");
  const [resendingId, setResendingId]       = useState<string | null>(null);
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed]   = useState<Date | null>(null);
  const searchTimeout                        = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback(
    (off: number) => {
      const p = new URLSearchParams();
      p.set("limit",   String(LIMIT));
      p.set("offset",  String(off));
      p.set("channel", channelFilter);
      p.set("status",  statusFilter);
      p.set("tracked", tracked);
      if (search) p.set("search", search);
      return p.toString();
    },
    [channelFilter, statusFilter, tracked, search]
  );

  const load = useCallback(
    async (append = false, off = 0) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const res  = await fetch(`/api/admin/delivery-diagnostics?${buildParams(off)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");

        if (append) {
          setAttempts(prev => [...prev, ...(data.attempts ?? [])]);
        } else {
          setAttempts(data.attempts ?? []);
          setOffset(0);
        }
        setStats(data.stats ?? null);
        setTotal(data.total ?? 0);
        setLastRefreshed(new Date());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildParams]
  );

  // Reload on filter change
  useEffect(() => { load(false, 0); }, [channelFilter, statusFilter, tracked, search]);

  // Debounced search
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(val), 400);
  };

  const handleLoadMore = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    load(true, newOffset);
  };

  // ── Copy provider ID ──
  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    toast({ title: "Copied", description: id.slice(0, 40) });
  };

  // ── Resend ──
  const handleResend = async (attempt: DiagnosticsAttempt) => {
    setResendingId(attempt.id);
    try {
      const res  = await fetch(`/api/admin/delivery-diagnostics/${attempt.id}/resend`, { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        toast({
          title: "Message resent",
          description: `New attempt #${data.new_attempt_number} queued via ${attempt.channel}${
            data.provider_message_id ? ` (${data.provider_message_id.slice(0, 16)}…)` : ""
          }.`,
        });
        load(false, 0);
      } else {
        toast({
          title: "Resend failed",
          description: data.error ?? "Unknown error",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Resend error", description: e.message, variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  // ── Stats ──
  const inFlight = stats ? stats.queued + stats.sent : 0;
  const problemCount = stats ? stats.bounced + stats.failed + stats.undeliverable : 0;
  const deliveredPct =
    stats && stats.total > 0
      ? Math.round((stats.delivered / stats.total) * 100)
      : null;

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 max-w-[1400px]">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MailCheck className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Delivery Diagnostics</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time delivery tracking for all seller email and SMS attempts. Resend failed messages directly from this panel.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Refreshed {formatRelative(lastRefreshed.toISOString())}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(false, 0)}
              disabled={loading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            title="Tracked Attempts"
            value={stats?.total ?? 0}
            sub={`${stats?.by_channel.email ?? 0} email · ${stats?.by_channel.sms ?? 0} SMS`}
            color="gray"
            icon={<MailCheck className="h-4 w-4" />}
          />
          <StatCard
            title="Delivered"
            value={stats?.delivered ?? 0}
            sub={deliveredPct !== null ? `${deliveredPct}% delivery rate` : undefined}
            color="green"
            icon={<CheckCircle className="h-4 w-4" />}
          />
          <StatCard
            title="In-Flight"
            value={inFlight}
            sub="Queued or accepted"
            color="blue"
            icon={<Clock className="h-4 w-4" />}
          />
          <StatCard
            title="Bounced"
            value={stats?.bounced ?? 0}
            sub="Email address issues"
            color="amber"
            icon={<AlertCircle className="h-4 w-4" />}
          />
          <StatCard
            title="Failed / Undeliverable"
            value={problemCount}
            sub="Needs attention"
            color="red"
            icon={<XCircle className="h-4 w-4" />}
          />
        </div>

        {/* ── Filters ── */}
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Provider ID, destination, or order UUID…"
                className="pl-8"
                data-testid="input-search"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Channel</Label>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[130px]" data-testid="select-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="undeliverable">Undeliverable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Tracking</Label>
            <Select value={tracked} onValueChange={setTracked}>
              <SelectTrigger className="w-[150px]" data-testid="select-tracked">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tracked">Tracked only</SelectItem>
                <SelectItem value="all">All attempts</SelectItem>
                <SelectItem value="untracked">Untracked only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {problemCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              onClick={() => setStatusFilter("failed")}
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Show failures ({problemCount})
            </Button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ── Table ── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {loading ? "Loading…" : `${total.toLocaleString()} attempt${total === 1 ? "" : "s"}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : attempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <MailCheck className="h-8 w-8 opacity-30" />
                <p className="text-sm">No attempts found for the current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="pl-4">Order</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead className="text-center">#</TableHead>
                      <TableHead>Provider ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Delivered At</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead className="pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map(attempt => {
                      const isExpanded    = expandedId === attempt.id;
                      const canResend     = (attempt.channel === "email" || attempt.channel === "sms")
                                            && (!attempt.delivery_status || RESENDABLE.has(attempt.delivery_status));
                      const isResending   = resendingId === attempt.id;
                      const vehicleLabel  = [attempt.vehicle_year, attempt.vehicle_make, attempt.vehicle_model]
                                            .filter(Boolean).join(" ") || "—";

                      return (
                        <>
                          <TableRow
                            key={attempt.id}
                            className="text-xs cursor-pointer hover:bg-muted/30"
                            onClick={() => setExpandedId(isExpanded ? null : attempt.id)}
                            data-testid={`row-attempt-${attempt.id}`}
                          >
                            {/* Order */}
                            <TableCell className="pl-4">
                              <div className="space-y-0.5">
                                <p className="font-medium text-[11px] leading-tight">{vehicleLabel}</p>
                                <Link
                                  href={`/admin/orders/${attempt.order_id}`}
                                  className="text-[10px] text-muted-foreground hover:underline flex items-center gap-1"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {attempt.order_id.slice(0, 8)}…
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </Link>
                              </div>
                            </TableCell>

                            {/* Channel */}
                            <TableCell>
                              <ChannelBadge channel={attempt.channel} />
                            </TableCell>

                            {/* Destination */}
                            <TableCell className="max-w-[140px]">
                              <span className="truncate block text-[11px]">
                                {attempt.destination ?? "—"}
                              </span>
                            </TableCell>

                            {/* Attempt # */}
                            <TableCell className="text-center">
                              <span className="font-mono text-[11px]">
                                {attempt.attempt_number === 99 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="opacity-60">99</span>
                                    </TooltipTrigger>
                                    <TooltipContent>Auto-notification (trust confirmation)</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  attempt.attempt_number
                                )}
                              </span>
                              {attempt.is_auto_notification && (
                                <Badge variant="outline" className="ml-1 text-[9px] opacity-50 px-1 py-0 h-3.5 no-default-hover-elevate no-default-active-elevate">
                                  auto
                                </Badge>
                              )}
                            </TableCell>

                            {/* Provider ID */}
                            <TableCell>
                              {attempt.provider_message_id ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[100px]">
                                    {attempt.provider_message_id.slice(0, 16)}…
                                  </span>
                                  <button
                                    onClick={e => { e.stopPropagation(); copyId(attempt.provider_message_id!); }}
                                    className="text-muted-foreground hover:text-foreground shrink-0"
                                    data-testid={`button-copy-id-${attempt.id}`}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground opacity-50">—</span>
                              )}
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              <DeliveryStatusBadge status={attempt.delivery_status} />
                            </TableCell>

                            {/* Sent at */}
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[11px] text-muted-foreground cursor-default">
                                    {formatRelative(attempt.created_at)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{formatDateTime(attempt.created_at)}</TooltipContent>
                              </Tooltip>
                            </TableCell>

                            {/* Delivered at */}
                            <TableCell>
                              {attempt.delivery_updated_at && attempt.delivery_status === "delivered" ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[11px] text-green-700 dark:text-green-400 cursor-default">
                                      {formatRelative(attempt.delivery_updated_at)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{formatDateTime(attempt.delivery_updated_at)}</TooltipContent>
                                </Tooltip>
                              ) : attempt.delivery_updated_at ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[11px] text-muted-foreground cursor-default">
                                      {formatRelative(attempt.delivery_updated_at)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Status changed: {formatDateTime(attempt.delivery_updated_at)}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-[11px] text-muted-foreground opacity-40">—</span>
                              )}
                            </TableCell>

                            {/* Latency */}
                            <TableCell>
                              <span
                                className={`text-[11px] font-mono ${
                                  attempt.latency_seconds !== null && attempt.latency_seconds < 30
                                    ? "text-green-600 dark:text-green-400"
                                    : attempt.latency_seconds !== null && attempt.latency_seconds < 300
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {formatLatency(attempt.latency_seconds)}
                              </span>
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="pr-4 text-right">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      size="sm"
                                      variant={canResend ? "outline" : "ghost"}
                                      className={`h-7 text-[11px] gap-1.5 ${
                                        canResend
                                          ? "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950"
                                          : "opacity-30 cursor-default"
                                      }`}
                                      onClick={e => {
                                        e.stopPropagation();
                                        if (canResend) handleResend(attempt);
                                      }}
                                      disabled={isResending || !canResend}
                                      data-testid={`button-resend-${attempt.id}`}
                                    >
                                      {isResending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Send className="h-3 w-3" />
                                      )}
                                      Resend
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {canResend
                                    ? attempt.channel === "email"
                                      ? "Resend email using stored message text. Note: original HTML body is not retained — plain text will be used."
                                      : "Resend SMS using stored message body."
                                    : attempt.delivery_status === "delivered"
                                    ? "Message already delivered."
                                    : attempt.delivery_status === "queued" || attempt.delivery_status === "sent"
                                    ? "Message is still in-flight."
                                    : "Resend is not available for this channel."}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>

                          {/* ── Expanded detail row ── */}
                          {isExpanded && (
                            <TableRow
                              key={`${attempt.id}-expanded`}
                              className="bg-muted/20 hover:bg-muted/20"
                            >
                              <TableCell colSpan={10} className="px-4 py-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                  {/* Provider info */}
                                  <div className="space-y-1.5">
                                    <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Provider Details</p>
                                    <div className="space-y-1">
                                      <div className="flex gap-2">
                                        <span className="font-medium w-24 shrink-0">Message ID:</span>
                                        {attempt.provider_message_id ? (
                                          <span className="font-mono text-[11px] break-all">{attempt.provider_message_id}</span>
                                        ) : (
                                          <span className="text-muted-foreground">Not tracked</span>
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        <span className="font-medium w-24 shrink-0">Channel:</span>
                                        <span className="capitalize">{attempt.channel}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <span className="font-medium w-24 shrink-0">Template:</span>
                                        <span className="font-mono">{attempt.message_template_key ?? "manual"}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <span className="font-medium w-24 shrink-0">Source:</span>
                                        <span>{attempt.is_auto_notification ? "Auto-notification" : "Ops manual / retry"}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Timestamps */}
                                  <div className="space-y-1.5">
                                    <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Timeline</p>
                                    <div className="space-y-1">
                                      <div className="flex gap-2">
                                        <span className="font-medium w-24 shrink-0">Sent at:</span>
                                        <span>{formatDateTime(attempt.created_at)}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <span className="font-medium w-24 shrink-0">Status update:</span>
                                        <span>{attempt.delivery_updated_at ? formatDateTime(attempt.delivery_updated_at) : "—"}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <span className="font-medium w-24 shrink-0">Latency:</span>
                                        <span className="font-mono">{formatLatency(attempt.latency_seconds)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Message preview */}
                                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                                    <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Message Preview</p>
                                    {attempt.message_body ? (
                                      <p className="text-muted-foreground leading-relaxed line-clamp-4">
                                        {attempt.message_body}
                                      </p>
                                    ) : (
                                      <p className="text-muted-foreground italic">No message body stored.</p>
                                    )}
                                    {attempt.channel === "email" && canResend && (
                                      <p className="flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                                        <Info className="h-3 w-3 shrink-0 mt-0.5" />
                                        Email resend uses plain text — original HTML not retained.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Load more */}
            {!loading && attempts.length > 0 && attempts.length < total && (
              <div className="flex justify-center py-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  data-testid="button-load-more"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Load more ({total - attempts.length} remaining)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
