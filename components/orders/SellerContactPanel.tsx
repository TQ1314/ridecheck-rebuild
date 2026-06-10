"use client";

import { useState, useEffect } from "react";
import type { Order, SellerContactAttempt, SellerContactChannel } from "@/types/orders";
import { detectSellerPlatform, getAllowedChannels, getChannelLabel } from "@/lib/seller-contact/platforms";
import { getTemplateForChannel } from "@/lib/seller-contact/templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  MessageSquare,
  Phone,
  Mail,
  ExternalLink,
  Copy,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Info,
  MapPin,
  Loader2,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRelative } from "@/lib/utils/format";

interface SellerContactPanelProps {
  order: Order;
  onRefresh: () => void;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "accepted":
      return "default";
    case "attempting":
      return "secondary";
    case "declined":
    case "invalid_contact":
      return "destructive";
    default:
      return "outline";
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
    // seller_status operational values
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
    // Facebook Marketplace buyer-bridge statuses
    facebook_seller_approval_pending: "FB: Awaiting Seller Approval",
    facebook_seller_approved: "FB: Seller Approved",
    facebook_seller_declined: "FB: Seller Declined",
    facebook_contact_info_needed: "FB: Contact Info Needed",
  };
  return labels[status] || status;
}

function getAttemptStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    sent: "Sent",
    failed: "Failed",
    delivered: "Delivered",
    replied: "Replied",
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
    case "fb_message":
      return <MessageSquare className="h-3 w-3" />;
    case "call":
      return <Phone className="h-3 w-3" />;
    case "sms":
      return <MessageSquare className="h-3 w-3" />;
    case "email":
      return <Mail className="h-3 w-3" />;
    case "buyer_message":
      return <User className="h-3 w-3" />;
    default:
      return <MessageSquare className="h-3 w-3" />;
  }
}

export function SellerContactPanel({ order, onRefresh }: SellerContactPanelProps) {
  const { toast } = useToast();
  const [attempts, setAttempts] = useState<SellerContactAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [newAttemptOpen, setNewAttemptOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [messageBody, setMessageBody] = useState("");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [buyerConfirmed, setBuyerConfirmed] = useState(false);
  const [buyerNotes, setBuyerNotes] = useState("");
  const [buyerSubmitting, setBuyerSubmitting] = useState(false);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const [responseDialogAttemptId, setResponseDialogAttemptId] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState("");
  const [markingResponse, setMarkingResponse] = useState(false);
  const [settingFbStatus, setSettingFbStatus] = useState(false);

  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenLoading, setReopenLoading] = useState(false);

  // Tracks which attempt rows have their delivery details panel expanded
  const [expandedAttempts, setExpandedAttempts] = useState<Set<string>>(new Set());

  const platform = detectSellerPlatform(order.listing_url);
  const allowedChannels = getAllowedChannels(platform);
  const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;
  const isConcierge = order.booking_type === "concierge";
  const isSelfArranged = order.booking_type === "self_arrange";
  const contactStatus = order.seller_contact_status || "not_started";
  // Count only manual ops attempts — exclude automated system notifications and buyer_message entries
  const attemptCount = attempts.filter(
    (a) => !a.is_auto_notification && a.channel !== "buyer_message"
  ).length;

  useEffect(() => {
    loadAttempts();
  }, [order.id]);

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

  useEffect(() => {
    if (selectedChannel && newAttemptOpen) {
      const nextAttemptNumber = attemptCount + 1;
      const template = getTemplateForChannel(
        selectedChannel as SellerContactChannel,
        platform,
        vehicleLabel,
        order.preferred_date,
        nextAttemptNumber,
      );
      setMessageBody(template);
    }
  }, [selectedChannel, newAttemptOpen]);

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
        body: JSON.stringify({
          outcome,
          notes: outcomeNotes || undefined,
        }),
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
        body: JSON.stringify({
          channel: "buyer_message",
          message_body: body,
          status: "sent",
        }),
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
    facebook: "Facebook",
    craigslist: "Craigslist",
    dealer: "Dealer",
    other: "Other",
  };

  const buyerTemplate = getTemplateForChannel("buyer_message", platform, vehicleLabel, order.preferred_date);

  return (
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
        {order.listing_source === "dealership" && (
          <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-sm">
            <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-emerald-800 dark:text-emerald-300">
              <strong>Dealership sale.</strong> Call the dealership during business hours to schedule a time for the RideChecker to inspect the vehicle on the lot.
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
          {order.seller_phone && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {order.listing_source === "dealership"
                  ? "Dealership Phone"
                  : order.listing_source === "roadside"
                    ? "Phone from Sign"
                    : "Seller Phone"}
              </span>
              <span className="font-medium" data-testid="text-seller-phone">{order.seller_phone}</span>
            </div>
          )}
          {order.seller_email && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Seller Email</span>
              <span className="font-medium" data-testid="text-seller-email">{order.seller_email}</span>
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
        {order.vehicle_seen_location && (
          <div className="flex items-start gap-2 rounded-md bg-muted/50 border px-3 py-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Car Location</span>
              <p className="font-medium mt-0.5" data-testid="text-vehicle-seen-location">{order.vehicle_seen_location}</p>
            </div>
          </div>
        )}

        {order.listing_url && (
          <a
            href={order.listing_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" data-testid="button-open-listing">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Listing
            </Button>
          </a>
        )}

        {/* ── Facebook Marketplace buyer bridge ────────────────────────── */}
        {platform === 'facebook' && isConcierge && (
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
                  { value: "facebook_seller_approved", label: "Seller Approved" },
                  { value: "facebook_seller_declined", label: "Seller Declined" },
                  { value: "facebook_contact_info_needed", label: "Need Contact Info" },
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

        {isConcierge && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span
              className="text-xs text-muted-foreground"
              data-testid="text-attempt-count"
            >
              {attemptCount}/3 logged
            </span>
            {attemptCount < 3 ? (
              <Button
                variant="outline"
                onClick={handleNewAttemptOpen}
                data-testid="button-new-attempt"
              >
                <Plus className="h-4 w-4 mr-2" />
                Log Attempt {attemptCount + 1}
              </Button>
            ) : contactStatus !== "accepted" ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-amber-500" />
                3 attempts logged — mark the outcome below.
              </p>
            ) : null}
            </div>

            <Dialog open={newAttemptOpen} onOpenChange={setNewAttemptOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Seller Contact Attempt</DialogTitle>
                  <DialogDescription>
                    Select a channel and customize the message before logging the attempt.
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
                    <Label className="mb-2 block">Message</Label>
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
                    <Button
                      variant="outline"
                      onClick={() => setNewAttemptOpen(false)}
                    >
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

            {/* Reopen seller outreach — shown when status is a closed outcome */}
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

      {/* Seller response dialog */}
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

      {/* Decline confirmation dialog */}
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

      {/* Reopen seller outreach dialog */}
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
  );
}
