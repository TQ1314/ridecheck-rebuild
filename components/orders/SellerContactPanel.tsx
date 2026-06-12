"use client";

import { useState, useEffect } from "react";
import type { Order, SellerContactAttempt, SellerContactChannel } from "@/types/orders";
import { detectSellerPlatform, getAllowedChannels, getChannelLabel } from "@/lib/seller-contact/platforms";
import { getTemplateForChannel, getSellerTemplates } from "@/lib/seller-contact/templates";
import { getSellerMessage, getAllAttempts, getAttemptLabel } from "@/lib/seller-contact/sellerMessaging";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  MessageSquare,
  Phone,
  Mail,
  ExternalLink,
  Copy,
  Plus,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Info,
  MapPin,
  Loader2,
  Send,
  ClipboardList,
  ArrowDownLeft,
  Calendar,
  RefreshCw,
  CalendarCheck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatRelative } from "@/lib/utils/format";

interface SellerContactPanelProps {
  order: Order;
  onRefresh: () => void;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "accepted":  return "default";
    case "attempting": return "secondary";
    case "declined":
    case "invalid_contact": return "destructive";
    default: return "outline";
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_started: "Not Started",
    attempting: "Attempting",
    accepted: "Accepted",
    declined: "Declined",
    no_response: "No Response",
    invalid_contact: "Invalid Contact",
    awaiting: "Awaiting Contact",
    seller_not_contacted: "Not Contacted",
    seller_contacted: "Contacted",
    awaiting_seller_response: "Awaiting Response",
    seller_confirmed: "Seller Confirmed",
    seller_reschedule_requested: "Reschedule Requested",
    seller_declined: "Seller Declined",
    seller_no_response: "No Response",
    vehicle_sold: "Vehicle Sold",
    unsafe_location_flagged: "Unsafe Location",
    confirmed: "Confirmed",
    invalid: "Invalid",
    facebook_seller_approval_pending: "FB: Awaiting Seller Approval",
    facebook_seller_approved: "FB: Seller Approved",
    facebook_seller_declined: "FB: Seller Declined",
    facebook_contact_info_needed: "FB: Contact Info Needed",
  };
  return labels[status] || status;
}

function getAttemptStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    sent: "Sent", failed: "Failed", delivered: "Delivered", replied: "Replied",
  };
  return labels[status] || status;
}

function DeliveryStatusBadge({ status }: { status: string }) {
  type Cfg = { icon: React.ReactNode; label: string; className: string };
  const config: Record<string, Cfg> = {
    queued: {
      icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
      label: "Queued",
      className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
    },
    sent: {
      icon: <Send className="h-2.5 w-2.5" />,
      label: "Sent to Provider",
      className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
    },
    delivered: {
      icon: <CheckCircle className="h-2.5 w-2.5" />,
      label: "✓ Delivered",
      className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
    },
    bounced: {
      icon: <AlertCircle className="h-2.5 w-2.5" />,
      label: "⚠ Bounced",
      className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
    },
    failed: {
      icon: <XCircle className="h-2.5 w-2.5" />,
      label: "✗ Failed",
      className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
    },
    undeliverable: {
      icon: <XCircle className="h-2.5 w-2.5" />,
      label: "⚠ Undeliverable",
      className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
    },
  };
  const c = config[status] ?? config.sent;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border no-default-hover-elevate no-default-active-elevate ${c.className}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

function getChannelIcon(channel: string) {
  switch (channel) {
    case "fb_message": return <MessageSquare className="h-3 w-3" />;
    case "call":       return <Phone className="h-3 w-3" />;
    case "sms":        return <MessageSquare className="h-3 w-3" />;
    case "email":      return <Mail className="h-3 w-3" />;
    case "buyer_message": return <User className="h-3 w-3" />;
    default:           return <MessageSquare className="h-3 w-3" />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function SellerContactPanel({ order, onRefresh }: SellerContactPanelProps) {
  const { toast } = useToast();

  // ── Existing state ──
  const [attempts, setAttempts]             = useState<SellerContactAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [newAttemptOpen, setNewAttemptOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [messageBody, setMessageBody]       = useState("");
  const [destination, setDestination]       = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const [outcomeNotes, setOutcomeNotes]     = useState("");
  const [buyerConfirmed, setBuyerConfirmed] = useState(false);
  const [buyerNotes, setBuyerNotes]         = useState("");
  const [buyerSubmitting, setBuyerSubmitting] = useState(false);
  const [declineOpen, setDeclineOpen]       = useState(false);
  const [declineReason, setDeclineReason]   = useState("");
  const [responseDialogAttemptId, setResponseDialogAttemptId] = useState<string | null>(null);
  const [responseNotes, setResponseNotes]   = useState("");
  const [markingResponse, setMarkingResponse] = useState(false);
  const [settingFbStatus, setSettingFbStatus] = useState(false);
  const [reopenOpen, setReopenOpen]         = useState(false);
  const [reopenReason, setReopenReason]     = useState("");
  const [reopenLoading, setReopenLoading]   = useState(false);
  const [expandedAttempts, setExpandedAttempts] = useState<Set<string>>(new Set());

  // ── NEW: direct send state ──
  const [smsModalOpen, setSmsModalOpen]     = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [smsTo, setSmsTo]                   = useState("");
  const [smsMessage, setSmsMessage]         = useState("");
  const [emailTo, setEmailTo]               = useState("");
  const [emailSubject, setEmailSubject]     = useState("");
  const [emailMessage, setEmailMessage]     = useState("");
  const [sending, setSending]               = useState(false);
  // Email-to-field edit mode (true when no seller_email on file, or when editing)
  const [emailToEditable, setEmailToEditable]   = useState(false);
  const [saveEmailToOrder, setSaveEmailToOrder] = useState(false);
  const [emailError, setEmailError]             = useState("");
  // Template variant pickers (1 = Initial, 2 = Follow-up, 3 = Final)
  const [smsVariant, setSmsVariant]     = useState<1 | 2 | 3>(1);
  const [emailVariant, setEmailVariant] = useState<1 | 2 | 3>(1);

  // ── Communication Center ──
  const [commTab, setCommTab]               = useState("replies");
  const [replies, setReplies]               = useState<any[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [sellerConfirming, setSellerConfirming] = useState(false);
  const [scheduleOpen, setScheduleOpen]     = useState(false);
  const [scheduleAddress, setScheduleAddress] = useState(order.seller_inspection_address || "");
  const [scheduleDate, setScheduleDate]     = useState(order.seller_available_date || "");
  const [scheduleTime, setScheduleTime]     = useState(order.seller_available_time || "");
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const platform       = detectSellerPlatform(order.listing_url);
  const allowedChannels = getAllowedChannels(platform);
  const vehicleLabel   = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;
  const isConcierge    = order.booking_type === "concierge";
  const isSelfArranged = order.booking_type === "self_arrange";
  const contactStatus  = order.seller_contact_status || "not_started";

  // Count only manual ops attempts (exclude auto-notifications and buyer messages)
  const attemptCount = attempts.filter(
    (a) => !a.is_auto_notification && a.channel !== "buyer_message"
  ).length;

  useEffect(() => { loadAttempts(); loadReplies(); }, [order.id]);

  async function loadReplies() {
    setRepliesLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/seller-replies`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.replies) ? data.replies : [];
        setReplies(list);
        setUnreadCount(list.filter((r: any) => !r.is_read).length);
      }
    } catch {
      // silently fail
    } finally {
      setRepliesLoading(false);
    }
  }

  async function loadAttempts() {
    setAttemptsLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/seller-contact`);
      if (res.ok) {
        const data = await res.json();
        setAttempts(Array.isArray(data) ? data : data.attempts || []);
      }
    } catch {
      // silently fail
    } finally {
      setAttemptsLoading(false);
    }
  }

  // Populate manual-log dialog template when channel changes
  useEffect(() => {
    if (selectedChannel && newAttemptOpen) {
      const nextAttemptNumber = attemptCount + 1;
      const template = getTemplateForChannel(
        selectedChannel as SellerContactChannel,
        platform,
        vehicleLabel,
        order.preferred_date,
        nextAttemptNumber,
        order.listing_source,
      );
      setMessageBody(template);
    }
  }, [selectedChannel, newAttemptOpen]);

  // ── Open SMS send modal ──
  const openSmsModal = () => {
    const defaultVariant = Math.min(attemptCount + 1, 3) as 1 | 2 | 3;
    const msg = getSellerMessage({ vehicleLabel, listingSource: order.listing_source, preferredDate: order.preferred_date, attemptNumber: defaultVariant });
    setSmsTo(order.seller_phone || "");
    setSmsMessage(msg.smsBody);
    setSmsVariant(defaultVariant);
    setSmsModalOpen(true);
  };

  // ── Switch SMS template variant ──
  const selectSmsVariant = (n: 1 | 2 | 3) => {
    const msg = getSellerMessage({ vehicleLabel, listingSource: order.listing_source, preferredDate: order.preferred_date, attemptNumber: n });
    setSmsMessage(msg.smsBody);
    setSmsVariant(n);
  };

  // ── Open Email send modal ──
  const openEmailModal = () => {
    const defaultVariant = Math.min(attemptCount + 1, 3) as 1 | 2 | 3;
    const msg    = getSellerMessage({ vehicleLabel, listingSource: order.listing_source, preferredDate: order.preferred_date, attemptNumber: defaultVariant });
    const hasEmail = !!order.seller_email;
    setEmailTo(order.seller_email || "");
    setEmailSubject(msg.emailSubject);
    setEmailMessage(msg.emailText);
    setEmailVariant(defaultVariant);
    setEmailToEditable(!hasEmail);
    setSaveEmailToOrder(!hasEmail);
    setEmailError("");
    setEmailModalOpen(true);
  };

  // ── Switch Email template variant ──
  const selectEmailVariant = (n: 1 | 2 | 3) => {
    const msg = getSellerMessage({ vehicleLabel, listingSource: order.listing_source, preferredDate: order.preferred_date, attemptNumber: n });
    setEmailMessage(msg.emailText);
    setEmailSubject(msg.emailSubject);
    setEmailVariant(n);
  };

  // ── Mark Seller Confirmed ──
  const handleMarkSellerConfirmed = async () => {
    setSellerConfirming(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/seller-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_address: scheduleAddress || undefined,
          available_date:     scheduleDate || undefined,
          available_time:     scheduleTime || undefined,
        }),
      });
      if (res.ok) {
        toast({ title: "Seller confirmed", description: "Status updated to Confirmed." });
        onRefresh();
      } else {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setSellerConfirming(false);
    }
  };

  // ── Save schedule details ──
  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/seller-replies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reply_id:      "00000000-0000-0000-0000-000000000000",
          apply_date:    scheduleDate || undefined,
          apply_time:    scheduleTime || undefined,
          apply_address: scheduleAddress || undefined,
          mark_read:     false,
        }),
      });
      if (res.ok) {
        toast({ title: "Saved", description: "Schedule details saved to order." });
        setScheduleOpen(false);
        onRefresh();
      } else {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setScheduleSaving(false);
    }
  };

  // ── Apply extracted data from a reply ──
  const handleApplyExtracted = async (reply: any, field: "date" | "time" | "address", value: string) => {
    try {
      const body: any = { reply_id: reply.id, mark_read: true };
      if (field === "date")    body.apply_date    = value;
      if (field === "time")    body.apply_time    = value;
      if (field === "address") body.apply_address = value;
      await fetch(`/api/admin/orders/${order.id}/seller-replies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast({ title: "Applied", description: `${field.charAt(0).toUpperCase() + field.slice(1)} saved to order.` });
      onRefresh();
    } catch {
      toast({ title: "Error", description: "Failed to apply", variant: "destructive" });
    }
  };

  // ── Send SMS ──
  const handleSendSMS = async () => {
    if (!smsTo || !smsMessage.trim()) return;
    setSending(true);
    try {
      const variantKey = smsVariant === 1 ? "initial" : smsVariant === 2 ? "followup" : "final";
      const res = await fetch(`/api/admin/orders/${order.id}/seller-contact/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "sms",
          to: smsTo,
          message_body: smsMessage,
          template_key: `sms_seller_${variantKey}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "SMS error", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: data.success ? "SMS sent" : "SMS failed to send",
        description: data.success
          ? `Attempt #${data.attempt_number} dispatched. Delivery tracking active.`
          : `Attempt #${data.attempt_number} logged as failed.`,
        variant: data.success ? "default" : "destructive",
      });
      setSmsModalOpen(false);
      loadAttempts();
      onRefresh();
    } catch {
      toast({ title: "Failed to send SMS", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // ── Send Email ──
  const handleSendEmail = async () => {
    const toTrimmed = emailTo.trim();
    if (!toTrimmed || !emailMessage.trim() || !emailSubject.trim()) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toTrimmed)) {
      setEmailError("Please enter a valid email address (e.g. user@example.com or abc-def@reply.craigslist.org).");
      return;
    }
    setEmailError("");

    setSending(true);
    try {
      const shouldSave = saveEmailToOrder && toTrimmed !== (order.seller_email || "");
      const variantKey = emailVariant === 1 ? "initial" : emailVariant === 2 ? "followup" : "final";
      const res = await fetch(`/api/admin/orders/${order.id}/seller-contact/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          to: toTrimmed,
          subject: emailSubject,
          message_body: emailMessage,
          template_key: `email_seller_${variantKey}`,
          save_seller_email: shouldSave,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Email error", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: data.success ? "Email sent" : "Email failed to send",
        description: data.success
          ? `Attempt #${data.attempt_number} dispatched. Delivery tracking active.${shouldSave ? " Email saved to order." : ""}`
          : `Attempt #${data.attempt_number} logged as failed.`,
        variant: data.success ? "default" : "destructive",
      });
      setEmailModalOpen(false);
      loadAttempts();
      onRefresh();
    } catch {
      toast({ title: "Failed to send email", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // ── Existing handlers ──
  const handleNewAttemptOpen = () => {
    setSelectedChannel("");
    setMessageBody("");
    setDestination("");
    setNewAttemptOpen(true);
  };

  const handleLogAttempt = async (status: "sent" | "failed") => {
    if (!selectedChannel) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/seller-contact/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: selectedChannel,
          destination: destination || undefined,
          message_template_key: selectedChannel,
          message_body: messageBody || undefined,
          status,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: `Attempt logged as ${status}` });
      setNewAttemptOpen(false);
      loadAttempts();
      onRefresh();
    } catch {
      toast({ title: "Failed to log attempt", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOutcome = async (outcome: "accepted" | "declined" | "no_response" | "invalid_contact") => {
    setOutcomeLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/seller-contact/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, notes: outcomeNotes || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: `Outcome: ${getStatusLabel(outcome)}` });
      setOutcomeNotes("");
      onRefresh();
    } catch {
      toast({ title: "Failed to set outcome", variant: "destructive" });
    } finally {
      setOutcomeLoading(false);
    }
  };

  const handleCopyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Message copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleConfirmDecline = async () => {
    setOutcomeLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/seller-contact/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: "declined", notes: declineReason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Outcome: Declined" });
      setDeclineOpen(false);
      setDeclineReason("");
      onRefresh();
    } catch {
      toast({ title: "Failed to set outcome", variant: "destructive" });
    } finally {
      setOutcomeLoading(false);
    }
  };

  const handleReopen = async () => {
    setReopenLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/seller-contact/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reopenReason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Seller outreach reopened" });
      setReopenOpen(false);
      setReopenReason("");
      onRefresh();
    } catch {
      toast({ title: "Failed to reopen", variant: "destructive" });
    } finally {
      setReopenLoading(false);
    }
  };

  const handleMarkResponse = async (responseReceived: boolean) => {
    if (!responseDialogAttemptId) return;
    setMarkingResponse(true);
    try {
      const res = await fetch(
        `/api/admin/orders/${order.id}/seller-contact/attempt/${responseDialogAttemptId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response_received: responseReceived,
            response_notes: responseNotes || undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: responseReceived ? "Seller response recorded" : "Marked no response" });
      setResponseDialogAttemptId(null);
      setResponseNotes("");
      loadAttempts();
      onRefresh();
    } catch {
      toast({ title: "Failed to record response", variant: "destructive" });
    } finally {
      setMarkingResponse(false);
    }
  };

  const handleSetFbStatus = async (fbStatus: string) => {
    setSettingFbStatus(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/seller-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_status: fbStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: `Status: ${getStatusLabel(fbStatus)}` });
      onRefresh();
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setSettingFbStatus(false);
    }
  };

  const handleBuyerUpdate = async () => {
    setBuyerSubmitting(true);
    try {
      const body = buyerConfirmed
        ? `Buyer confirmed seller agreed to inspection. ${buyerNotes}`.trim()
        : `Buyer update: ${buyerNotes}`.trim();
      const res = await fetch(`/api/admin/orders/${order.id}/seller-contact/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "buyer_message", message_body: body, status: "sent" }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Buyer update logged" });
      setBuyerNotes("");
      setBuyerConfirmed(false);
      loadAttempts();
      onRefresh();
    } catch {
      toast({ title: "Failed to log update", variant: "destructive" });
    } finally {
      setBuyerSubmitting(false);
    }
  };

  const platformLabels: Record<string, string> = {
    facebook: "Facebook", craigslist: "Craigslist", dealer: "Dealer", other: "Other",
  };

  const buyerTemplate = getTemplateForChannel("buyer_message", platform, vehicleLabel, order.preferred_date, 1, order.listing_source);

  // Whether any direct-send button should be visible
  const hasSmsTarget   = !!order.seller_phone;
  // Show email button when seller_email is known OR listing_url exists (for Craigslist relay)
  const hasEmailTarget = !!order.seller_email || !!order.listing_url;
  const hasListing     = !!order.listing_url;
  const missingEmail   = !order.seller_email && !!order.listing_url;
  const showActionBar  = hasSmsTarget || hasEmailTarget || hasListing;

  return (
    <TooltipProvider>
      <Card data-testid="seller-contact-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Seller Contact
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="no-default-hover-elevate no-default-active-elevate"
                data-testid="badge-platform"
              >
                {platformLabels[platform] || platform}
              </Badge>
              <Badge
                variant={getStatusBadgeVariant(contactStatus)}
                className="no-default-hover-elevate no-default-active-elevate"
                data-testid="badge-contact-status"
              >
                {getStatusLabel(contactStatus)}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Source banners */}
          {order.listing_source === "dealership" && (
            <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-sm">
              <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
              <span className="text-emerald-800 dark:text-emerald-300">
                <strong>Dealership sale.</strong> Call or email the dealership during business hours to schedule a time for the RideChecker to inspect the vehicle on the lot.
              </span>
            </div>
          )}
          {order.listing_source === "roadside" && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <span className="text-amber-800 dark:text-amber-300">
                <strong>Roadside / For Sale sign.</strong> Contact the seller using the phone number from the sign. No listing URL available.
              </span>
            </div>
          )}

          {/* ── Seller info grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Vehicle Found</span>
              <span className="font-medium" data-testid="text-listing-source">
                {order.listing_source === "dealership"
                  ? "Used Car Dealership"
                  : order.listing_source === "roadside"
                    ? "Roadside / For Sale Sign"
                    : "Online Marketplace / Listing"}
              </span>
            </div>
            {order.platform_source && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Platform / Source</span>
                <span className="font-medium capitalize" data-testid="text-platform-source">
                  {order.platform_source.replace(/_/g, " ")}
                </span>
              </div>
            )}
            {order.seller_name && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">
                  {order.listing_source === "dealership" ? "Dealership Name" : "Seller Name"}
                </span>
                <span className="font-medium" data-testid="text-seller-name">{order.seller_name}</span>
              </div>
            )}

            {/* Clickable phone → opens SMS modal */}
            {order.seller_phone && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">
                  {order.listing_source === "dealership"
                    ? "Dealership Phone"
                    : order.listing_source === "roadside"
                      ? "Phone from Sign"
                      : "Seller Phone"}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={openSmsModal}
                      className="font-medium text-primary hover:underline flex items-center gap-1.5 group"
                      data-testid="button-clickable-phone"
                    >
                      {order.seller_phone}
                      <MessageSquare className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to send an SMS</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Clickable email → opens Email modal */}
            {order.seller_email && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Seller Email</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={openEmailModal}
                      className="font-medium text-primary hover:underline flex items-center gap-1.5 group"
                      data-testid="button-clickable-email"
                    >
                      {order.seller_email}
                      <Mail className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to send an email</TooltipContent>
                </Tooltip>
              </div>
            )}

            {order.vehicle_price && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Asking Price</span>
                <span className="font-medium" data-testid="text-asking-price">
                  ${Number(order.vehicle_price).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Vehicle seen location */}
          {order.vehicle_seen_location && (
            <div className="flex items-start gap-2 rounded-md bg-muted/50 border px-3 py-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Car Location</span>
                <p className="font-medium mt-0.5" data-testid="text-vehicle-seen-location">{order.vehicle_seen_location}</p>
              </div>
            </div>
          )}

          {/* ── Quick action bar ── */}
          {showActionBar && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-2.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3 w-3 shrink-0" />
                Click phone/email above or use the buttons below to contact the seller.
              </p>
              {missingEmail && (
                <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <Info className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>
                    No seller email on file. Open the listing, copy the seller or relay email, paste it in the Send Email dialog, and send through RideCheck.
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {hasSmsTarget && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={openSmsModal}
                    data-testid="button-open-sms-modal"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Send SMS
                  </Button>
                )}
                {hasSmsTarget && (
                  <a href={`tel:${order.seller_phone}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      data-testid="button-call-seller"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call
                    </Button>
                  </a>
                )}
                {hasEmailTarget && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={openEmailModal}
                    data-testid="button-open-email-modal"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Send Email
                  </Button>
                )}
                {hasListing && (
                  <a href={order.listing_url!} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      data-testid="button-open-listing"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Listing
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Facebook Marketplace buyer bridge ── */}
          {platform === "facebook" && isConcierge && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Facebook Marketplace — Buyer Bridge Required</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                    Facebook TOS prohibits direct automated outreach. The buyer must message the seller first to obtain consent.
                    Direct Facebook contact is only permitted after seller approval is marked or buyer provides off-platform contact info.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-blue-800 dark:text-blue-300">Buyer Script — Send this to the buyer to copy/paste</Label>
                <div className="p-2.5 rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-blue-950/50 text-xs text-foreground leading-relaxed" data-testid="text-fb-buyer-script">
                  "Hi, I'm interested in your vehicle. Before moving forward, I would like an independent RideCheck inspection. RideCheck may need to coordinate directly with you regarding access to the vehicle. Is that okay?"
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                  onClick={() => handleCopyMessage(`"Hi, I'm interested in your vehicle. Before moving forward, I would like an independent RideCheck inspection. RideCheck may need to coordinate directly with you regarding access to the vehicle. Is that okay?"`)}
                  data-testid="button-copy-fb-buyer-script"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Buyer Script
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                <Label className="text-xs text-blue-800 dark:text-blue-300">Seller Approval Status</Label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "facebook_seller_approval_pending", label: "Pending" },
                    { value: "facebook_seller_approved",         label: "Seller Approved" },
                    { value: "facebook_seller_declined",         label: "Seller Declined" },
                    { value: "facebook_contact_info_needed",     label: "Need Contact Info" },
                  ] as const).map(({ value, label }) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={(order.seller_status as string) === value ? "default" : "outline"}
                      onClick={() => handleSetFbStatus(value)}
                      disabled={settingFbStatus}
                      className="text-xs h-7"
                      data-testid={`button-fb-status-${value}`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {order.seller_status?.startsWith("facebook_") && (
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Current: <strong>{getStatusLabel(order.seller_status)}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Concierge block ── */}
          {isConcierge && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground" data-testid="text-attempt-count">
                  {attemptCount}/3 logged
                </span>
                {attemptCount < 3 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground h-8 text-xs"
                    onClick={handleNewAttemptOpen}
                    data-testid="button-new-attempt"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Log Manual/Offline Attempt
                  </Button>
                ) : contactStatus !== "accepted" ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-amber-500" />
                    3 attempts logged — mark the outcome below.
                  </p>
                ) : null}
              </div>

              {/* Attempt history */}
              {attemptsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : attempts.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Attempt History</Label>
                  {attempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="flex items-start gap-3 text-sm p-2 rounded-md border"
                      data-testid={`attempt-${attempt.id}`}
                    >
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        {getChannelIcon(attempt.channel)}
                        <span className="text-xs font-medium">#{attempt.attempt_number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs">{getChannelLabel(attempt.channel as SellerContactChannel)}</span>
                          {attempt.destination && (
                            <span className="text-xs text-muted-foreground">{attempt.destination}</span>
                          )}
                          {attempt.delivery_status ? (
                            <DeliveryStatusBadge status={attempt.delivery_status} />
                          ) : (
                            <Badge
                              variant={attempt.status === "sent" ? "secondary" : "destructive"}
                              className="no-default-hover-elevate no-default-active-elevate text-[10px]"
                            >
                              {getAttemptStatusLabel(attempt.status)}
                            </Badge>
                          )}
                          {attempt.is_auto_notification && (
                            <Badge
                              variant="outline"
                              className="no-default-hover-elevate no-default-active-elevate text-[10px] opacity-60"
                            >
                              auto
                            </Badge>
                          )}
                          {attempt.response_received ? (
                            <Badge className="no-default-hover-elevate no-default-active-elevate text-[10px] bg-green-100 text-green-800 border-green-200">
                              <CheckCircle className="h-2.5 w-2.5 mr-1" />
                              Replied
                            </Badge>
                          ) : (
                            <button
                              className="text-[10px] text-muted-foreground underline hover:text-foreground"
                              onClick={() => {
                                setResponseDialogAttemptId(attempt.id);
                                setResponseNotes("");
                              }}
                              data-testid={`button-mark-response-${attempt.id}`}
                            >
                              Mark response
                            </button>
                          )}
                        </div>
                        {attempt.message_body && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {attempt.message_body}
                          </p>
                        )}
                        {attempt.response_received && attempt.response_notes && (
                          <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                            Reply: {attempt.response_notes}
                          </p>
                        )}
                        {attempt.provider_message_id && (
                          <div className="mt-1.5">
                            <button
                              className="text-[10px] text-muted-foreground underline hover:text-foreground"
                              onClick={() =>
                                setExpandedAttempts((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(attempt.id)) next.delete(attempt.id);
                                  else next.add(attempt.id);
                                  return next;
                                })
                              }
                              data-testid={`button-delivery-details-${attempt.id}`}
                            >
                              {expandedAttempts.has(attempt.id) ? "Hide details" : "View Delivery Details"}
                            </button>
                            {expandedAttempts.has(attempt.id) && (
                              <div className="mt-1.5 p-2 rounded-md bg-muted/40 border space-y-1 text-[10px] text-muted-foreground">
                                <div className="flex gap-2">
                                  <span className="font-medium shrink-0">Provider ID:</span>
                                  <span className="font-mono truncate">{attempt.provider_message_id}</span>
                                </div>
                                <div className="flex gap-2">
                                  <span className="font-medium shrink-0">Channel:</span>
                                  <span className="capitalize">{attempt.channel}</span>
                                </div>
                                {attempt.delivery_updated_at && (
                                  <div className="flex gap-2">
                                    <span className="font-medium shrink-0">Last update:</span>
                                    <span>{formatRelative(attempt.delivery_updated_at)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatRelative(attempt.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contact attempts yet.</p>
              )}

              {/* Outcome controls */}
              {contactStatus !== "accepted" && (
                <div className="space-y-3 border-t pt-3">
                  <Label className="text-xs text-muted-foreground">Set Outcome</Label>
                  <div>
                    <Textarea
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      placeholder="Outcome notes (optional)..."
                      rows={2}
                      data-testid="input-outcome-notes"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handleOutcome("accepted")}
                      disabled={outcomeLoading}
                      data-testid="button-mark-accepted"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark Accepted
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeclineOpen(true)}
                      disabled={outcomeLoading}
                      data-testid="button-mark-declined"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Mark Declined
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOutcome("no_response")}
                      disabled={outcomeLoading || attemptCount < 3}
                      title={attemptCount < 3 ? `Need at least 3 seller contact attempts (${attemptCount}/3 logged)` : undefined}
                      data-testid="button-mark-no-response"
                    >
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Mark No Response
                      {attemptCount < 3 && (
                        <span className="ml-1 text-[10px] opacity-70">({attemptCount}/3)</span>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleOutcome("invalid_contact")}
                      disabled={outcomeLoading}
                      data-testid="button-mark-invalid"
                    >
                      Invalid Contact
                    </Button>
                  </div>
                </div>
              )}

              {/* Reopen */}
              {["declined", "no_response", "invalid_contact", "accepted"].includes(contactStatus) && (
                <div className="border-t pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => setReopenOpen(true)}
                    data-testid="button-reopen-outreach"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    Reopen Seller Outreach
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Self-arranged block ── */}
          {isSelfArranged && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Buyer Coordination Mode</p>
                  <p className="text-xs text-muted-foreground">
                    The buyer is responsible for coordinating with the seller directly.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Message for Buyer to Send to Seller</Label>
                <div className="p-3 rounded-md border bg-muted/30 text-sm whitespace-pre-wrap" data-testid="text-buyer-template">
                  {buyerTemplate}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyMessage(buyerTemplate)}
                  data-testid="button-copy-buyer-message"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Message for Buyer
                </Button>
              </div>

              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="buyer-confirmed"
                    checked={buyerConfirmed}
                    onCheckedChange={(checked) => setBuyerConfirmed(checked === true)}
                    data-testid="checkbox-buyer-confirmed"
                  />
                  <Label htmlFor="buyer-confirmed" className="text-sm cursor-pointer">
                    Buyer confirmed seller agreed to inspection
                  </Label>
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-muted-foreground">Notes</Label>
                  <Textarea
                    value={buyerNotes}
                    onChange={(e) => setBuyerNotes(e.target.value)}
                    placeholder="Notes about buyer coordination..."
                    rows={2}
                    data-testid="input-buyer-notes"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleBuyerUpdate}
                  disabled={buyerSubmitting}
                  data-testid="button-log-buyer-update"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {buyerSubmitting ? "Logging..." : "Log Buyer Update"}
                </Button>
              </div>

              {attemptsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : attempts.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Update History</Label>
                  {attempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="flex items-start gap-3 text-sm p-2 rounded-md border"
                      data-testid={`attempt-${attempt.id}`}
                    >
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        <User className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {attempt.message_body && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {attempt.message_body}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatRelative(attempt.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>

        {/* ═══════════════════════════════════════════════════════════════════
            DIALOGS
        ═══════════════════════════════════════════════════════════════════ */}

        {/* ── Send SMS modal ── */}
        <Dialog open={smsModalOpen} onOpenChange={(o) => { if (!o && !sending) setSmsModalOpen(false); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Send SMS to Seller
              </DialogTitle>
              <DialogDescription>
                Message will be sent via Twilio with delivery tracking. Delivery status updates automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div>
                <Label className="mb-1.5 block text-sm">To</Label>
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground select-all">
                  {smsTo || "No phone number on file"}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Message</Label>
                  <span className={`text-xs ${smsMessage.length > 160 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {smsMessage.length} chars{smsMessage.length > 160 ? " (multi-part)" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs text-muted-foreground mr-1 shrink-0">Template:</span>
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => selectSmsVariant(n)}
                      data-testid={`button-sms-variant-${n}`}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        smsVariant === n
                          ? "bg-[#22774F] text-white border-[#22774F]"
                          : "bg-transparent text-muted-foreground border-input hover:border-[#22774F] hover:text-[#22774F]"
                      }`}
                    >
                      {getAttemptLabel(n)}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  rows={5}
                  data-testid="input-sms-message"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSmsModalOpen(false)}
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendSMS}
                  disabled={sending || !smsMessage.trim() || !smsTo}
                  data-testid="button-send-sms"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send SMS
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Send Email modal ── */}
        <Dialog open={emailModalOpen} onOpenChange={(o) => { if (!o && !sending) { setEmailModalOpen(false); setEmailError(""); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Send Email to Seller
              </DialogTitle>
              <DialogDescription>
                Message will be sent via Resend with delivery tracking. Delivery status updates automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-1">

              {/* ── To field ── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-sm">To</Label>
                  {!emailToEditable && order.seller_email && (
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={() => { setEmailToEditable(true); setSaveEmailToOrder(true); }}
                      data-testid="button-change-email"
                    >
                      Change Email
                    </button>
                  )}
                </div>

                {emailToEditable ? (
                  <div className="space-y-2">
                    {/* Craigslist / no-email helper */}
                    {missingEmail && (
                      <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          Open the listing, copy the seller or relay email, paste it here, then send through RideCheck.
                        </span>
                      </div>
                    )}
                    <Input
                      type="email"
                      value={emailTo}
                      onChange={(e) => { setEmailTo(e.target.value); setEmailError(""); }}
                      placeholder="Paste seller email or Craigslist relay email"
                      className={emailError ? "border-red-500 focus-visible:ring-red-500" : ""}
                      data-testid="input-email-to"
                      autoFocus
                    />
                    {emailError && (
                      <p className="text-xs text-red-600 dark:text-red-400" data-testid="text-email-error">
                        {emailError}
                      </p>
                    )}
                    {/* Save to order checkbox */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="save-email-to-order"
                        checked={saveEmailToOrder}
                        onCheckedChange={(checked) => setSaveEmailToOrder(!!checked)}
                        data-testid="checkbox-save-email"
                      />
                      <label
                        htmlFor="save-email-to-order"
                        className="text-xs text-muted-foreground cursor-pointer select-none"
                      >
                        Save this email to the order for future contact
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm select-all">
                    {emailTo || <span className="text-muted-foreground">No email address on file</span>}
                  </div>
                )}
              </div>

              {/* ── Subject ── */}
              <div>
                <Label className="mb-1.5 block text-sm">Subject</Label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  data-testid="input-email-subject"
                />
              </div>

              {/* ── Message body ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Message</Label>
                  <span className="text-xs text-muted-foreground">Plain text · sent as formatted email</span>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs text-muted-foreground mr-1 shrink-0">Template:</span>
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => selectEmailVariant(n)}
                      data-testid={`button-email-variant-${n}`}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        emailVariant === n
                          ? "bg-[#22774F] text-white border-[#22774F]"
                          : "bg-transparent text-muted-foreground border-input hover:border-[#22774F] hover:text-[#22774F]"
                      }`}
                    >
                      {getAttemptLabel(n)}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                  data-testid="input-email-message"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setEmailModalOpen(false); setEmailError(""); }}
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={sending || !emailMessage.trim() || !emailSubject.trim() || !emailTo.trim()}
                  data-testid="button-send-email"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  {emailToEditable && saveEmailToOrder ? "Save Email & Send" : "Send Email"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Log Manual/Offline Attempt modal ── */}
        <Dialog open={newAttemptOpen} onOpenChange={setNewAttemptOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Manual / Offline Attempt</DialogTitle>
              <DialogDescription>
                For calls, Facebook messages, or other off-platform attempts that can't be sent directly.
                Use "Send SMS" or "Send Email" above for tracked digital outreach.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="mb-2 block">Channel</Label>
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger data-testid="select-channel">
                    <SelectValue placeholder="Select channel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedChannels.map((ch) => (
                      <SelectItem key={ch} value={ch}>
                        {getChannelLabel(ch)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Destination (optional)</Label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Phone, email, or profile URL..."
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  data-testid="input-destination"
                />
              </div>
              <div>
                <Label className="mb-2 block">Message / Notes</Label>
                <Textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={6}
                  data-testid="input-message-body"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyMessage(messageBody)}
                  disabled={!messageBody}
                  data-testid="button-copy-message"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Message
                </Button>
                {selectedChannel === "fb_message" && (
                  <p className="text-xs text-muted-foreground">
                    Copy and paste this message into Facebook Messenger manually.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNewAttemptOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleLogAttempt("failed")}
                  disabled={submitting || !selectedChannel}
                  data-testid="button-log-failed"
                >
                  {submitting ? "Logging..." : "Log Failed"}
                </Button>
                <Button
                  onClick={() => handleLogAttempt("sent")}
                  disabled={submitting || !selectedChannel}
                  data-testid="button-log-sent"
                >
                  {submitting ? "Logging..." : "Log Sent"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Seller response dialog ── */}
        <Dialog open={!!responseDialogAttemptId} onOpenChange={(o) => { if (!o) setResponseDialogAttemptId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Seller Response</DialogTitle>
              <DialogDescription>
                Record whether the seller responded to this contact attempt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="mb-2 block text-sm">Response notes (optional)</Label>
                <Textarea
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  placeholder="e.g. Seller agreed to inspection, will call back tomorrow..."
                  rows={3}
                  data-testid="input-response-notes"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setResponseDialogAttemptId(null)}
                  disabled={markingResponse}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleMarkResponse(false)}
                  disabled={markingResponse}
                  data-testid="button-mark-no-response"
                >
                  {markingResponse ? "Saving…" : "No Response"}
                </Button>
                <Button
                  onClick={() => handleMarkResponse(true)}
                  disabled={markingResponse}
                  data-testid="button-confirm-response"
                >
                  {markingResponse ? "Saving…" : "Seller Replied"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Decline confirmation dialog ── */}
        <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm: Mark Seller Declined</DialogTitle>
              <DialogDescription>
                This records that the seller declined the inspection request. You can reopen outreach if the situation changes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="mb-2 block text-sm">Reason (optional)</Label>
                <Textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g. Seller said car is no longer available..."
                  rows={3}
                  data-testid="input-decline-reason"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={outcomeLoading}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDecline}
                  disabled={outcomeLoading}
                  data-testid="button-confirm-decline"
                >
                  {outcomeLoading ? "Saving…" : "Confirm Declined"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Reopen seller outreach dialog ── */}
        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reopen Seller Outreach</DialogTitle>
              <DialogDescription>
                This resets the seller contact status to "Attempting." Previous attempts and timeline events are preserved.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="mb-2 block text-sm">Reason for reopening (optional)</Label>
                <Textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Buyer provided updated contact info for seller..."
                  rows={3}
                  data-testid="input-reopen-reason"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReopenOpen(false)} disabled={reopenLoading}>
                  Cancel
                </Button>
                <Button
                  onClick={handleReopen}
                  disabled={reopenLoading}
                  data-testid="button-confirm-reopen"
                >
                  {reopenLoading ? "Reopening…" : "Reopen Outreach"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          SELLER COMMUNICATION CENTER
          Shows all outbound attempts organised by channel, plus inbound
          seller replies with AI-extracted scheduling data.
      ══════════════════════════════════════════════════════════════════ */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#22774F]" />
              Seller Communication
              {unreadCount > 0 && (
                <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { loadAttempts(); loadReplies(); }}
              data-testid="button-refresh-comms"
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </div>

          {/* ── Extracted availability summary ── */}
          {(order.seller_available_date || order.seller_available_time || order.seller_inspection_address) && (
            <div className="mt-2 rounded-md border border-[#22774F]/20 bg-[#22774F]/5 p-3 text-sm space-y-1">
              <p className="text-xs font-semibold text-[#22774F] uppercase tracking-wide mb-1.5">Seller Provided</p>
              {order.seller_available_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-[#22774F] shrink-0" />
                  <span className="font-medium">Date:</span>
                  <span>{order.seller_available_date}</span>
                </div>
              )}
              {order.seller_available_time && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-[#22774F] shrink-0" />
                  <span className="font-medium">Time:</span>
                  <span>{order.seller_available_time}</span>
                </div>
              )}
              {order.seller_inspection_address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-[#22774F] shrink-0" />
                  <span className="font-medium">Address:</span>
                  <span>{order.seller_inspection_address}</span>
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          <Tabs value={commTab} onValueChange={setCommTab}>
            <TabsList className="w-full mb-4 h-9">
              <TabsTrigger value="replies" className="flex-1 text-xs" data-testid="tab-comms-replies">
                <ArrowDownLeft className="h-3 w-3 mr-1" />
                Replies
                {unreadCount > 0 && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="email" className="flex-1 text-xs" data-testid="tab-comms-email">
                <Mail className="h-3 w-3 mr-1" />
                Email
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({attempts.filter((a) => a.channel === "email").length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex-1 text-xs" data-testid="tab-comms-sms">
                <MessageSquare className="h-3 w-3 mr-1" />
                SMS
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({attempts.filter((a) => a.channel === "sms").length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="calls" className="flex-1 text-xs" data-testid="tab-comms-calls">
                <Phone className="h-3 w-3 mr-1" />
                Calls
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({attempts.filter((a) => ["call", "fb_message", "buyer_message"].includes(a.channel)).length})
                </span>
              </TabsTrigger>
            </TabsList>

            {/* ── Replies tab ── */}
            <TabsContent value="replies" className="mt-0">
              {repliesLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading replies…
                </div>
              ) : replies.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <ArrowDownLeft className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>No seller replies yet.</p>
                  <p className="text-xs mt-1 opacity-70">
                    Replies come in automatically via SMS (Twilio) and email (inbound routing).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {replies.map((reply: any) => (
                    <div
                      key={reply.id}
                      data-testid={`reply-card-${reply.id}`}
                      className="rounded-lg border bg-muted/30 p-3 space-y-2"
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {reply.channel === "sms"
                          ? <MessageSquare className="h-3 w-3 text-blue-500" />
                          : <Mail className="h-3 w-3 text-purple-500" />}
                        <span className="font-medium text-foreground capitalize">{reply.channel}</span>
                        <span>·</span>
                        <span>{reply.from_address}</span>
                        <span>·</span>
                        <span>{new Date(reply.created_at).toLocaleString()}</span>
                        {!reply.is_read && (
                          <span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600 uppercase">
                            New
                          </span>
                        )}
                      </div>

                      {/* Subject (email only) */}
                      {reply.subject && (
                        <p className="text-xs font-medium">{reply.subject}</p>
                      )}

                      {/* Body */}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.body}</p>

                      {/* Extracted data chips */}
                      {(reply.extracted_dates?.length > 0 ||
                        reply.extracted_times?.length > 0 ||
                        reply.extracted_addresses?.length > 0 ||
                        reply.extracted_phones?.length > 0) && (
                        <div className="pt-1 border-t border-dashed border-border">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                            Auto-extracted
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(reply.extracted_dates || []).map((d: string, i: number) => (
                              <button
                                key={`d${i}`}
                                onClick={() => handleApplyExtracted(reply, "date", d)}
                                data-testid={`chip-date-${reply.id}-${i}`}
                                className="inline-flex items-center gap-1 rounded-full border border-[#22774F]/30 bg-[#22774F]/10 px-2 py-0.5 text-[11px] font-medium text-[#22774F] hover:bg-[#22774F]/20 transition-colors"
                                title="Click to apply to order"
                              >
                                <Calendar className="h-2.5 w-2.5" />
                                {d}
                              </button>
                            ))}
                            {(reply.extracted_times || []).map((t: string, i: number) => (
                              <button
                                key={`t${i}`}
                                onClick={() => handleApplyExtracted(reply, "time", t)}
                                data-testid={`chip-time-${reply.id}-${i}`}
                                className="inline-flex items-center gap-1 rounded-full border border-blue-300/50 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                                title="Click to apply to order"
                              >
                                <Clock className="h-2.5 w-2.5" />
                                {t}
                              </button>
                            ))}
                            {(reply.extracted_addresses || []).map((a: string, i: number) => (
                              <button
                                key={`a${i}`}
                                onClick={() => handleApplyExtracted(reply, "address", a)}
                                data-testid={`chip-address-${reply.id}-${i}`}
                                className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                                title="Click to apply to order"
                              >
                                <MapPin className="h-2.5 w-2.5" />
                                {a}
                              </button>
                            ))}
                            {(reply.extracted_phones || []).map((p: string, i: number) => (
                              <span
                                key={`p${i}`}
                                data-testid={`chip-phone-${reply.id}-${i}`}
                                className="inline-flex items-center gap-1 rounded-full border border-gray-300/50 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                              >
                                <Phone className="h-2.5 w-2.5" />
                                {p}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Click a chip to apply it to the order fields.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Email tab ── */}
            <TabsContent value="email" className="mt-0">
              {attempts.filter((a) => a.channel === "email").length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No email attempts yet.</p>
              ) : (
                <div className="space-y-2">
                  {attempts
                    .filter((a) => a.channel === "email")
                    .map((a) => (
                      <div key={a.id} className="flex items-start gap-2 rounded-md border p-3 text-sm" data-testid={`email-attempt-${a.id}`}>
                        <Mail className="h-3.5 w-3.5 mt-0.5 text-purple-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">Attempt #{a.attempt_number}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                            {a.delivery_status && (
                              <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                                a.delivery_status === "delivered" ? "bg-green-100 text-green-700" :
                                a.delivery_status === "failed" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>{a.delivery_status}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{a.destination}</p>
                          {a.message_body && (
                            <p className="mt-1 text-xs line-clamp-2 text-muted-foreground">{a.message_body}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>

            {/* ── SMS tab ── */}
            <TabsContent value="sms" className="mt-0">
              {attempts.filter((a) => a.channel === "sms").length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No SMS attempts yet.</p>
              ) : (
                <div className="space-y-2">
                  {attempts
                    .filter((a) => a.channel === "sms")
                    .map((a) => (
                      <div key={a.id} className="flex items-start gap-2 rounded-md border p-3 text-sm" data-testid={`sms-attempt-${a.id}`}>
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">Attempt #{a.attempt_number}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                            {a.delivery_status && (
                              <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                                a.delivery_status === "delivered" ? "bg-green-100 text-green-700" :
                                a.delivery_status === "failed" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>{a.delivery_status}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{a.destination}</p>
                          {a.message_body && (
                            <p className="mt-1 text-xs text-muted-foreground">{a.message_body}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>

            {/* ── Calls tab ── */}
            <TabsContent value="calls" className="mt-0">
              {attempts.filter((a) => ["call", "fb_message", "buyer_message"].includes(a.channel)).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No calls or manual contact logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {attempts
                    .filter((a) => ["call", "fb_message", "buyer_message"].includes(a.channel))
                    .map((a) => (
                      <div key={a.id} className="flex items-start gap-2 rounded-md border p-3 text-sm" data-testid={`call-attempt-${a.id}`}>
                        <Phone className="h-3.5 w-3.5 mt-0.5 text-gray-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium capitalize">{a.channel.replace("_", " ")}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">Attempt #{a.attempt_number}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                          </div>
                          {a.message_body && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{a.message_body}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* ── Action buttons ── */}
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
            {/* Schedule Inspection */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScheduleOpen(true)}
              data-testid="button-schedule-inspection"
              className="text-xs gap-1.5"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Schedule Inspection
            </Button>

            {/* Assign RideChecker — scrolls to assignment section in the ops panel */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const el = document.getElementById("assignment-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
                else toast({ title: "Use the Assignment section above to assign a RideChecker." });
              }}
              data-testid="button-assign-ridechecker"
              className="text-xs gap-1.5"
            >
              <User className="h-3.5 w-3.5" />
              Assign RideChecker
            </Button>

            {/* Mark Seller Confirmed */}
            {contactStatus !== "confirmed" ? (
              <Button
                size="sm"
                onClick={handleMarkSellerConfirmed}
                disabled={sellerConfirming}
                data-testid="button-mark-seller-confirmed"
                className="text-xs gap-1.5 bg-[#22774F] hover:bg-[#1a5c3c] text-white"
              >
                {sellerConfirming
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <CheckCircle2 className="h-3.5 w-3.5" />}
                Mark Seller Confirmed
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-md bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Seller Confirmed
                {order.seller_confirmed_at && (
                  <span className="text-green-500 font-normal">· {new Date(order.seller_confirmed_at).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Schedule Inspection dialog ── */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-[#22774F]" />
              Schedule Inspection
            </DialogTitle>
            <DialogDescription>
              Record the seller's confirmed availability and inspection address. These will be saved to the order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm mb-1.5 block">Available Date</Label>
              <Input
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                placeholder="e.g. Tuesday March 18, or 3/18/2026"
                data-testid="input-schedule-date"
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Available Time</Label>
              <Input
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                placeholder="e.g. 10am, afternoon, 2:00 PM"
                data-testid="input-schedule-time"
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Inspection Address</Label>
              <Input
                value={scheduleAddress}
                onChange={(e) => setScheduleAddress(e.target.value)}
                placeholder="e.g. 456 Oak Ave, Waukegan, IL 60085"
                data-testid="input-schedule-address"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setScheduleOpen(false)} disabled={scheduleSaving}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveSchedule}
                disabled={scheduleSaving || (!scheduleDate && !scheduleTime && !scheduleAddress)}
                data-testid="button-save-schedule"
                className="bg-[#22774F] hover:bg-[#1a5c3c] text-white"
              >
                {scheduleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Details"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </TooltipProvider>
  );
}
