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

  const platform = detectSellerPlatform(order.listing_url);
  const allowedChannels = getAllowedChannels(platform);
  const vehicleLabel = `${order.vehicle_year} ${order.vehicle_make} ${order.vehicle_model}`;
  const isConcierge = order.booking_type === "concierge";
  const isSelfArranged = order.booking_type === "self_arrange";
  const contactStatus = order.seller_contact_status || "not_started";
  const attemptCount = attempts.length;

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
      const template = getTemplateForChannel(
        selectedChannel as SellerContactChannel,
        platform,
        vehicleLabel,
        order.preferred_date
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

        {isConcierge && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleNewAttemptOpen}
                data-testid="button-new-attempt"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Attempt
              </Button>
              {attemptCount >= 3 && contactStatus !== "accepted" && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  3 attempts completed. You can now mark No Response.
                </p>
              )}
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
                        <Badge
                          variant={attempt.status === "sent" ? "secondary" : "destructive"}
                          className="no-default-hover-elevate no-default-active-elevate text-[10px]"
                        >
                          {getAttemptStatusLabel(attempt.status)}
                        </Badge>
                      </div>
                      {attempt.message_body && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
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
                    onClick={() => handleOutcome("declined")}
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
                    title={attemptCount < 3 ? "Need at least 3 attempts before marking no response" : undefined}
                    data-testid="button-mark-no-response"
                  >
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Mark No Response
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
    </Card>
  );
}
