"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare, Mail, Phone, ArrowDownLeft, ArrowUpRight,
  RefreshCw, Send, Loader2, User, Store, Car, Bot,
  ChevronUp, DollarSign, FileText, CheckCircle2, AlertTriangle,
  Zap, Clock, Bell,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRelative } from "@/lib/utils/format";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CommMessage {
  id: string;
  source: "seller_message" | "seller_attempt" | "event";
  direction: "inbound" | "outbound" | "internal";
  sender_type: string;
  recipient_type: string;
  channel: string;
  body: string;
  subject?: string | null;
  status?: string | null;
  is_read?: boolean;
  created_at: string;
  meta?: Record<string, unknown>;
}

interface Props { order: Order; onRefresh?: () => void; }

type FilterTab = "all" | "seller" | "buyer" | "ridechecker" | "system";

// ── Style helpers ──────────────────────────────────────────────────────────────

function partyConfig(type: string): { label: string; cls: string; icon: ReactNode } {
  switch (type) {
    case "seller":      return { label: "Seller",      cls: "bg-blue-100   text-blue-700   border-blue-200   dark:bg-blue-950/40   dark:text-blue-300   dark:border-blue-800",   icon: <Store className="h-3 w-3" /> };
    case "buyer":       return { label: "Buyer",       cls: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800", icon: <User className="h-3 w-3" /> };
    case "ridechecker": return { label: "RideChecker", cls: "bg-green-100  text-green-700  border-green-200  dark:bg-green-950/40  dark:text-green-300  dark:border-green-800",  icon: <Car className="h-3 w-3" /> };
    case "ops":         return { label: "Ops",         cls: "bg-amber-100  text-amber-700  border-amber-200  dark:bg-amber-950/40  dark:text-amber-300  dark:border-amber-800",  icon: <User className="h-3 w-3" /> };
    case "system":      return { label: "System",      cls: "bg-gray-100   text-gray-600   border-gray-200   dark:bg-gray-800      dark:text-gray-400   dark:border-gray-700",   icon: <Bot className="h-3 w-3" /> };
    default:            return { label: type,          cls: "bg-gray-100   text-gray-600   border-gray-200",                                                                     icon: <MessageSquare className="h-3 w-3" /> };
  }
}

function channelIcon(channel: string): ReactNode {
  if (channel === "sms")          return <MessageSquare className="h-3 w-3" />;
  if (channel === "email")        return <Mail className="h-3 w-3" />;
  if (channel === "both")         return <Mail className="h-3 w-3" />;
  if (channel === "call" || channel === "phone_call") return <Phone className="h-3 w-3" />;
  if (channel === "in_app")       return <Zap className="h-3 w-3" />;
  return <MessageSquare className="h-3 w-3" />;
}

function statusCls(status?: string | null): string {
  switch (status) {
    case "delivered": return "text-green-600 dark:text-green-400";
    case "failed":    return "text-red-500 dark:text-red-400";
    case "queued":    return "text-amber-500 dark:text-amber-400";
    case "sent":      return "text-blue-500 dark:text-blue-400";
    case "received":  return "text-muted-foreground";
    default:          return "text-muted-foreground";
  }
}

function eventIcon(body: string): ReactNode {
  if (body.startsWith("Payment"))  return <DollarSign className="h-3.5 w-3.5 text-emerald-600" />;
  if (body.startsWith("Report"))   return <FileText className="h-3.5 w-3.5 text-blue-600" />;
  if (body.includes("accepted"))   return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
  if (body.includes("declined") || body.includes("refused")) return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  if (body.includes("reminder") || body.includes("Agreement")) return <Bell className="h-3.5 w-3.5 text-amber-500" />;
  if (body.includes("payout") || body.includes("Payout")) return <DollarSign className="h-3.5 w-3.5 text-violet-600" />;
  if (body.includes("Job offered") || body.includes("broadcast")) return <Zap className="h-3.5 w-3.5 text-amber-500" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />;
}

function matchesFilter(msg: CommMessage, tab: FilterTab): boolean {
  if (tab === "all")         return true;
  if (tab === "seller")      return msg.sender_type === "seller" || msg.recipient_type === "seller";
  if (tab === "buyer")       return msg.sender_type === "buyer"  || msg.recipient_type === "buyer";
  if (tab === "ridechecker") return msg.sender_type === "ridechecker" || msg.recipient_type === "ridechecker";
  if (tab === "system")      return msg.sender_type === "system" || msg.source === "event";
  return true;
}

// ── Timeline entry — for system / internal events ──────────────────────────────

function TimelineEntry({ msg }: { msg: CommMessage }) {
  const partyType = msg.sender_type === "ops" ? msg.recipient_type : msg.sender_type;
  const party     = partyConfig(partyType);
  return (
    <div className="flex items-start gap-2.5 py-1" data-testid={`event-${msg.id}`}>
      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted/60 border shrink-0 mt-0.5">
        {eventIcon(msg.body)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground/80 leading-snug">{msg.body}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`inline-flex items-center gap-0.5 rounded-full border px-1 py-0 text-[9px] font-medium ${party.cls}`}>
            {party.icon}{party.label}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
            {channelIcon(msg.channel)}
            {msg.channel === "in_app" ? "in-app" : msg.channel}
          </span>
          <span className="text-[10px] text-muted-foreground/50">{formatRelative(msg.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Message bubble — for real inbound/outbound message content ─────────────────

function MessageBubble({ msg }: { msg: CommMessage }) {
  const [expanded, setExpanded] = useState(true);
  const isOutbound = msg.direction === "outbound";
  const senderCfg  = partyConfig(isOutbound ? "ops" : msg.sender_type);
  const recipCfg   = partyConfig(isOutbound ? msg.recipient_type : "ops");
  const showExpand = msg.body.length > 220;
  const displayBody = !expanded && showExpand ? msg.body.slice(0, 220) + "…" : msg.body;

  return (
    <div className={`flex flex-col gap-1 ${isOutbound ? "items-end" : "items-start"}`} data-testid={`msg-${msg.id}`}>
      {/* Header row */}
      <div className={`flex items-center gap-1.5 text-[10px] text-muted-foreground ${isOutbound ? "flex-row-reverse" : ""}`}>
        {isOutbound
          ? <ArrowUpRight className="h-3 w-3 text-muted-foreground/50" />
          : <ArrowDownLeft className="h-3 w-3 text-muted-foreground/50" />}
        <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${senderCfg.cls}`}>
          {senderCfg.icon}{senderCfg.label}
        </span>
        <span className="opacity-40">→</span>
        <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${recipCfg.cls}`}>
          {recipCfg.icon}{recipCfg.label}
        </span>
        <span className="inline-flex items-center gap-0.5 opacity-50">
          {channelIcon(msg.channel)}
          {msg.channel === "in_app" ? "in-app" : msg.channel}
        </span>
        {msg.status && msg.status !== "received" && (
          <span className={`capitalize ${statusCls(msg.status)}`}>· {msg.status}</span>
        )}
        <span className="opacity-40">{formatRelative(msg.created_at)}</span>
      </div>

      {/* Body bubble */}
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap border ${
        isOutbound
          ? "bg-primary/8 border-primary/15 text-foreground"
          : "bg-muted/50 border-border text-foreground"
      }`}>
        {msg.subject && (
          <p className="font-semibold mb-1 text-[11px] text-muted-foreground">Re: {msg.subject}</p>
        )}
        {displayBody}
        {showExpand && (
          <button onClick={() => setExpanded((e) => !e)} className="block mt-1 text-primary hover:underline text-[10px]">
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      {/* Extracted scheduling data chips */}
      {!isOutbound && Boolean(msg.meta?.extracted) && (() => {
        const ex = (msg.meta!.extracted) as unknown as { dates?: string[]; times?: string[]; addresses?: string[] };
        const items = [
          ...(ex.dates?.map((d) => ({ label: "Date", value: d })) ?? []),
          ...(ex.times?.map((t) => ({ label: "Time", value: t })) ?? []),
          ...(ex.addresses?.map((a) => ({ label: "Address", value: a })) ?? []),
        ];
        if (items.length === 0) return null;
        return (
          <div className="max-w-[85%] flex flex-wrap gap-1 mt-0.5">
            {items.map((it, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded px-1.5 py-0.5">
                <span className="font-medium">{it.label}:</span> {it.value}
              </span>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CommunicationCenter({ order, onRefresh }: Props) {
  const { toast } = useToast();
  const [messages, setMessages]       = useState<CommMessage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter]           = useState<FilterTab>("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMsg, setComposeMsg]   = useState("");
  const [composeChannel, setComposeChannel] = useState<"email" | "sms" | "both">("both");
  const [sending, setSending]         = useState(false);
  const scrollRef                     = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/communications`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setUnreadCount(data.unread_count ?? 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [order.id]);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loading, messages.length]);

  const filtered = messages.filter((m) => matchesFilter(m, filter));

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all",         label: "All" },
    { key: "seller",      label: "Seller" },
    { key: "buyer",       label: "Buyer" },
    { key: "ridechecker", label: "RC" },
    { key: "system",      label: "System" },
  ];

  const handleSend = async () => {
    if (!composeMsg.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: composeMsg.trim(), channel: composeChannel, recipient_type: "buyer" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Send failed", description: data.error, variant: "destructive" });
        return;
      }
      const ch: string[] = [];
      if (data.email) ch.push("email");
      if (data.sms)   ch.push("SMS");
      toast({
        title: "Message sent to buyer",
        description: ch.length > 0 ? `Delivered via ${ch.join(" & ")}` : "Message dispatched.",
      });
      setComposeMsg("");
      setComposeOpen(false);
      load();
      onRefresh?.();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card data-testid="card-communication-center">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Communication Center
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={load} disabled={loading} data-testid="button-refresh-communications">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setComposeOpen((o) => !o)} data-testid="button-compose-message">
              {composeOpen ? <ChevronUp className="h-3 w-3" /> : <Send className="h-3 w-3" />}
              {composeOpen ? "Close" : "Message Buyer"}
            </Button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 flex-wrap mt-2">
          {TABS.map((t) => {
            const count  = t.key === "all" ? messages.length : messages.filter((m) => matchesFilter(m, t.key)).length;
            const active = filter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                data-testid={`tab-comm-${t.key}`}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                }`}
              >
                {t.label}
                {count > 0 && <span className={`text-[10px] ${active ? "opacity-80" : "opacity-60"}`}>{count}</span>}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Compose panel */}
        {composeOpen && (
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Message to Buyer ({order.customer_name || "customer"})
            </p>
            <Textarea
              value={composeMsg}
              onChange={(e) => setComposeMsg(e.target.value)}
              placeholder="Type your message to the buyer…"
              rows={3}
              className="text-xs resize-none"
              data-testid="textarea-compose-message"
            />
            <div className="flex items-center gap-2">
              <Select value={composeChannel} onValueChange={(v) => setComposeChannel(v as "email" | "sms" | "both")}>
                <SelectTrigger className="h-7 text-xs w-[110px]" data-testid="select-compose-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Email + SMS</SelectItem>
                  <SelectItem value="email">Email only</SelectItem>
                  <SelectItem value="sms">SMS only</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5 flex-1"
                onClick={handleSend}
                disabled={sending || !composeMsg.trim()}
                data-testid="button-send-buyer-message"
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Send
              </Button>
            </div>
          </div>
        )}

        {/* Message feed */}
        <div ref={scrollRef} className="space-y-3 max-h-[520px] overflow-y-auto pr-1" data-testid="feed-communications">
          {loading && (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />Loading…
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-1">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground/70">
                {filter === "all"
                  ? "Outbound contacts and inbound replies will appear here as this order progresses."
                  : `No ${filter} messages for this order.`}
              </p>
            </div>
          )}

          {!loading && filtered.map((msg, idx) => {
            const prev = filtered[idx - 1];
            // Show a date separator when the day changes
            const showDate = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
            const isTimelineEvent = msg.source === "event";
            const isBubble = !isTimelineEvent;

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                {isTimelineEvent ? <TimelineEntry msg={msg} /> : <MessageBubble msg={msg} />}
              </div>
            );
          })}
        </div>

        {!loading && messages.length > 0 && (
          <p className="text-[10px] text-muted-foreground text-center">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            {filter !== "all" ? ` in "${filter}" view` : " · seller_messages + contact attempts + order events"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
