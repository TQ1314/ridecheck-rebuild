"use client";

import { useState, useEffect, useCallback } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User, Mail, Phone, Package, CreditCard, Send, CheckCircle2,
  Loader2, MessageSquare, Smartphone, ChevronDown, ChevronUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { packageLabel } from "@/lib/utils/format";

interface BuyerMessage {
  id: string;
  created_at: string;
  details: { message?: string; channel?: string };
}

interface BuyerCardProps {
  order: Order;
  onRefresh: () => void;
}

const STATUS_TEMPLATES = [
  { label: "Custom message…", value: "" },
  { label: "Inspection scheduled — seller confirmed", value: "Great news! Your inspection has been scheduled and the seller has confirmed the appointment. We'll keep you updated on progress." },
  { label: "Inspector en route", value: "Your RideChecker is on their way to inspect the vehicle. You'll hear from us shortly with findings." },
  { label: "Inspection underway", value: "Your inspection is currently in progress. We're working on your intelligence report and will send it to you once it's ready." },
  { label: "Seller not responding — follow-up in progress", value: "We've been attempting to reach the seller to schedule your inspection. We're following up and will update you as soon as we have confirmation." },
  { label: "Report is being prepared", value: "Your inspection is complete. Our team is finalizing your intelligence report. You'll receive it by email very shortly." },
  { label: "Scheduling delay — apologies", value: "We wanted to let you know there has been a brief delay in scheduling your inspection. We're actively working to resolve this and appreciate your patience." },
];

function paymentBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
    case "paid_manual_verified":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Manually Verified</Badge>;
    case "requested":
    case "pending":
    case "unpaid":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Awaiting Payment</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-800 border-red-200">Payment Failed</Badge>;
    case "refunded":
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Refunded</Badge>;
    case "not_requested":
      return <Badge variant="outline">Not Requested</Badge>;
    default:
      return <Badge variant="outline">{status || "Unknown"}</Badge>;
  }
}

function formatRelativeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function BuyerCard({ order, onRefresh }: BuyerCardProps) {
  const { toast } = useToast();
  const [delivering, setDelivering] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [channel, setChannel] = useState<"both" | "email" | "sms">("both");
  const [sending, setSending] = useState(false);
  const [templateKey, setTemplateKey] = useState("");
  const [msgHistory, setMsgHistory] = useState<BuyerMessage[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const supabase = createClient();

  const loadMsgHistory = useCallback(async () => {
    const { data } = await supabase
      .from("order_events")
      .select("id, created_at, details")
      .eq("order_id", order.id)
      .eq("event_type", "buyer_message_sent")
      .order("created_at", { ascending: false })
      .limit(8);
    if (data) setMsgHistory(data as BuyerMessage[]);
  }, [order.id]);

  useEffect(() => { loadMsgHistory(); }, [loadMsgHistory]);

  const canDeliver = order.report_status === "approved" || order.report_status === "generated" || order.report_status === "report_ready" || !!order.report_storage_path || !!order.ops_report_url;
  const alreadyDelivered = !!order.report_delivered_at;

  const buyerEmail = order.buyer_email || order.customer_email;
  const buyerPhone = order.buyer_phone || order.customer_phone;

  function applyTemplate(value: string) {
    setTemplateKey(value);
    setMsgText(value);
  }

  async function handleDeliverReport() {
    setDelivering(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/deliver-report`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Delivery failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Report sent to buyer!", description: "Email delivered." });
      onRefresh();
    } catch {
      toast({ title: "Failed to deliver report", variant: "destructive" });
    } finally {
      setDelivering(false);
    }
  }

  async function handleSendMessage() {
    if (!msgText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/message-buyer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgText.trim(), channel }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed to send", description: data.error, variant: "destructive" });
        return;
      }
      const sent: string[] = [];
      if (data.email) sent.push("email");
      if (data.sms) sent.push("SMS");
      toast({
        title: "Message sent",
        description: sent.length > 0 ? `Delivered via ${sent.join(" & ")}` : "Message dispatched.",
      });
      setMsgText("");
      setTemplateKey("");
      setMsgOpen(false);
      loadMsgHistory();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  const channelAvailable = {
    email: !!buyerEmail,
    sms: !!buyerPhone,
  };

  return (
    <Card data-testid="card-buyer">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Buyer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{order.customer_name || "—"}</span>
          </div>
          {buyerEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a href={`mailto:${buyerEmail}`} className="text-primary hover:underline truncate" data-testid="link-buyer-email">
                {buyerEmail}
              </a>
            </div>
          )}
          {buyerPhone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a href={`tel:${buyerPhone}`} className="hover:underline" data-testid="link-buyer-phone">
                {buyerPhone}
              </a>
            </div>
          )}
        </div>

        <div className="pt-1 border-t space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium">{packageLabel(order.package)}</span>
            {order.final_price != null && (
              <span className="text-muted-foreground">${order.final_price}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {paymentBadge(order.payment_status)}
          </div>
        </div>

        {order.report_delivered_at && (
          <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-2 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Report delivered</span>
          </div>
        )}

        {/* Message history */}
        {msgHistory.length > 0 && (
          <div className="pt-1 border-t space-y-1.5">
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full transition-colors"
              onClick={() => setHistoryOpen((o) => !o)}
              data-testid="button-toggle-msg-history"
            >
              {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <MessageSquare className="h-3 w-3" />
              {msgHistory.length} message{msgHistory.length !== 1 ? "s" : ""} sent
            </button>
            {historyOpen && (
              <div className="rounded-md border divide-y max-h-40 overflow-y-auto" data-testid="list-msg-history">
                {msgHistory.map((m) => (
                  <div key={m.id} className="px-2.5 py-2 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">
                        {m.details?.channel === "sms" ? "SMS" : m.details?.channel === "email" ? "Email" : "Email + SMS"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatRelativeShort(m.created_at)}</span>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{m.details?.message || "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message buyer */}
        <div className="pt-1 border-t space-y-2">
          <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                data-testid="button-message-buyer"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Send Status Update
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Message Buyer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Channel indicator */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {channelAvailable.email && (
                    <span className="flex items-center gap-1 bg-muted rounded px-2 py-0.5">
                      <Mail className="h-3 w-3" /> Email available
                    </span>
                  )}
                  {channelAvailable.sms && (
                    <span className="flex items-center gap-1 bg-muted rounded px-2 py-0.5">
                      <Smartphone className="h-3 w-3" /> SMS available
                    </span>
                  )}
                  {!channelAvailable.email && !channelAvailable.sms && (
                    <span className="text-amber-600">No contact info on file</span>
                  )}
                </div>

                {/* Quick templates */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Quick template</Label>
                  <Select value={templateKey} onValueChange={applyTemplate}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-buyer-template">
                      <SelectValue placeholder="Pick a template or write custom…" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_TEMPLATES.map((t) => (
                        <SelectItem key={t.label} value={t.value || t.label} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Message</Label>
                  <Textarea
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Type your message here…"
                    rows={4}
                    className="text-sm resize-none"
                    data-testid="textarea-buyer-message"
                  />
                  <p className="text-xs text-muted-foreground text-right">{msgText.length}/1000</p>
                </div>

                {/* Channel selector */}
                {channelAvailable.email && channelAvailable.sms && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Send via</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-buyer-channel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both" className="text-xs">Email + SMS</SelectItem>
                        <SelectItem value="email" className="text-xs">Email only</SelectItem>
                        <SelectItem value="sms" className="text-xs">SMS only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  onClick={handleSendMessage}
                  disabled={sending || !msgText.trim() || (!channelAvailable.email && !channelAvailable.sms)}
                  data-testid="button-send-buyer-message"
                >
                  {sending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                  ) : (
                    <><Send className="h-4 w-4" />Send Message</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            size="sm"
            className="w-full gap-2"
            onClick={handleDeliverReport}
            disabled={delivering || !canDeliver}
            variant={alreadyDelivered ? "outline" : "default"}
            data-testid="button-deliver-report"
          >
            {delivering ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>
            ) : (
              <><Send className="h-3.5 w-3.5" />{alreadyDelivered ? "Resend Report" : "Send Report to Buyer"}</>
            )}
          </Button>
          {!canDeliver && !alreadyDelivered && (
            <p className="text-xs text-muted-foreground text-center">
              Generate the report first before delivering
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
