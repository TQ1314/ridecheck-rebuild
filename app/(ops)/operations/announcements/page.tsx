"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Megaphone,
  Mail,
  MessageSquare,
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Announcement {
  id: string;
  created_at: string;
  subject: string;
  body: string;
  channels: string[];
  recipient_group: string;
  area_filter?: string;
  recipient_count: number;
  email_sent: number;
  sms_sent: number;
  email_failed: number;
  sms_failed: number;
  sender?: { full_name: string };
}

const GROUP_LABELS: Record<string, string> = {
  all: "All active RideCheckers",
  available: "Available right now",
  area: "By service area",
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AnnouncementsPage() {
  const { toast } = useToast();

  // Form state
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipientGroup, setRecipientGroup] = useState("all");
  const [areaFilter, setAreaFilter] = useState("");
  const [useEmail, setUseEmail] = useState(true);
  const [useSMS, setUseSMS] = useState(false);

  // UI state
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Preview state
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // History
  const [history, setHistory] = useState<Announcement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/ops/announcements");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.announcements ?? []);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Fetch recipient preview count when filters change
  useEffect(() => {
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const params = new URLSearchParams({ group: recipientGroup });
        if (recipientGroup === "area" && areaFilter.trim()) {
          params.set("area", areaFilter.trim());
        }
        const res = await fetch(`/api/ops/announcements/preview?${params}`);
        if (res.ok) {
          const data = await res.json();
          setPreviewCount(data.count ?? 0);
        }
      } catch {
        setPreviewCount(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [recipientGroup, areaFilter]);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) {
      toast({ title: "Subject and message are required", variant: "destructive" });
      return;
    }
    if (!useEmail && !useSMS) {
      toast({ title: "Select at least one channel", variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmSend() {
    setSending(true);
    try {
      const channels = [useEmail && "email", useSMS && "sms"].filter(Boolean) as string[];
      const res = await fetch("/api/ops/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          channels,
          recipient_group: recipientGroup,
          area_filter: recipientGroup === "area" ? areaFilter.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed to send", description: data.error, variant: "destructive" });
        return;
      }
      const parts: string[] = [];
      if (data.email_sent > 0) parts.push(`${data.email_sent} email${data.email_sent > 1 ? "s" : ""}`);
      if (data.sms_sent > 0) parts.push(`${data.sms_sent} SMS`);
      toast({
        title: `Announcement sent to ${data.recipient_count} RideChecker${data.recipient_count !== 1 ? "s" : ""}`,
        description: parts.length ? `Delivered via ${parts.join(" + ")}` : undefined,
      });
      setSubject("");
      setMessage("");
      setRecipientGroup("all");
      setAreaFilter("");
      loadHistory();
    } catch {
      toast({ title: "Unexpected error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  const channels = [useEmail && "email", useSMS && "sms"].filter(Boolean) as string[];
  const canSend = subject.trim().length > 0 && message.trim().length > 0 && channels.length > 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Group Message</h1>
          <p className="text-sm text-muted-foreground">Send an announcement to RideCheckers by email or SMS</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Compose form */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Compose Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipients */}
            <div className="space-y-1.5">
              <Label className="text-xs">Recipients</Label>
              <Select value={recipientGroup} onValueChange={setRecipientGroup}>
                <SelectTrigger data-testid="select-recipient-group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All active RideCheckers</SelectItem>
                  <SelectItem value="available">Available right now</SelectItem>
                  <SelectItem value="area">By service area</SelectItem>
                </SelectContent>
              </Select>
              {recipientGroup === "area" && (
                <Input
                  placeholder="e.g. Dallas, Austin"
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="h-8 text-sm mt-1.5"
                  data-testid="input-area-filter"
                />
              )}
              {/* Preview count */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                {previewLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : previewCount !== null ? (
                  <>
                    <Users className="h-3 w-3" />
                    <span data-testid="text-recipient-count">
                      {previewCount} recipient{previewCount !== 1 ? "s" : ""}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            {/* Channels */}
            <div className="space-y-1.5">
              <Label className="text-xs">Channels</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={useEmail}
                    onCheckedChange={(v) => setUseEmail(!!v)}
                    data-testid="checkbox-channel-email"
                  />
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={useSMS}
                    onCheckedChange={(v) => setUseSMS(!!v)}
                    data-testid="checkbox-channel-sms"
                  />
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">SMS</span>
                </label>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-xs">Subject</Label>
              <Input
                id="subject"
                placeholder="e.g. Important update for all RideCheckers"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-sm"
                data-testid="input-subject"
              />
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="message" className="text-xs">Message</Label>
                <span className="text-[10px] text-muted-foreground">{message.length}/1600</span>
              </div>
              <Textarea
                id="message"
                placeholder="Write your message here…"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 1600))}
                rows={6}
                className="text-sm resize-none"
                data-testid="textarea-message"
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleSend}
              disabled={sending || !canSend}
              data-testid="button-send-announcement"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Megaphone className="h-4 w-4" />
              )}
              {sending ? "Sending…" : "Send Announcement"}
            </Button>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="lg:col-span-2 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <Mail className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
              <p><span className="text-foreground font-medium">Email</span> — best for longer updates, policy changes, training reminders. Delivered even if the RC's phone is off.</p>
            </div>
            <div className="flex gap-2">
              <MessageSquare className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
              <p><span className="text-foreground font-medium">SMS</span> — best for urgent, time-sensitive notices. Keep it short (under 160 chars for one segment).</p>
            </div>
            <div className="flex gap-2">
              <Users className="h-4 w-4 shrink-0 text-purple-500 mt-0.5" />
              <p><span className="text-foreground font-medium">Available now</span> — reaches only RideCheckers who have marked themselves available, useful for urgent job coverage.</p>
            </div>
            <div className="border-t pt-3 mt-1">
              <p className="text-[10px]">All announcements are logged below. This sends to <strong>active</strong> RideCheckers only — suspended or inactive accounts are excluded automatically.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Announcement History</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadHistory}
              disabled={historyLoading}
              className="h-7 gap-1.5 text-xs"
              data-testid="button-refresh-history"
            >
              <RefreshCw className={`h-3 w-3 ${historyLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Megaphone className="h-8 w-8 opacity-30" />
              <p className="text-sm">No announcements sent yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Subject</TableHead>
                  <TableHead className="text-xs">Recipients</TableHead>
                  <TableHead className="text-xs">Channels</TableHead>
                  <TableHead className="text-xs">Results</TableHead>
                  <TableHead className="text-xs">Sent by</TableHead>
                  <TableHead className="text-xs">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((a) => {
                  const hasFailures = a.email_failed > 0 || a.sms_failed > 0;
                  return (
                    <TableRow key={a.id} data-testid={`row-announcement-${a.id}`}>
                      <TableCell className="text-sm font-medium max-w-[200px] truncate py-2">
                        {a.subject}
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground">
                          {GROUP_LABELS[a.recipient_group] ?? a.recipient_group}
                          {a.area_filter && ` · ${a.area_filter}`}
                        </span>
                        <div className="text-xs font-medium">{a.recipient_count} RCs</div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-1 flex-wrap">
                          {a.channels.includes("email") && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 gap-0.5">
                              <Mail className="h-2.5 w-2.5" /> Email
                            </Badge>
                          )}
                          {a.channels.includes("sms") && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 gap-0.5">
                              <MessageSquare className="h-2.5 w-2.5" /> SMS
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1">
                          {hasFailures ? (
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          )}
                          <span className="text-xs">
                            {a.email_sent + a.sms_sent} sent
                            {hasFailures && (
                              <span className="text-amber-600 ml-1">
                                · {a.email_failed + a.sms_failed} failed
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2">
                        {a.sender?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatRelative(a.created_at)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send announcement?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This will send <strong>"{subject}"</strong> to{" "}
                  <strong>{previewCount ?? "…"} RideChecker{(previewCount ?? 0) !== 1 ? "s" : ""}</strong>{" "}
                  via {channels.join(" + ")}.
                </p>
                <p className="text-muted-foreground">This cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSend}
              disabled={sending}
              data-testid="button-confirm-send"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Yes, send it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
