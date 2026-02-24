"use client";
import { useEffect, useState } from "react";
import type { Order, RideCheckerRawSubmission, RideCheckerJobAssignment } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, CheckCircle2, XCircle, DollarSign, Camera, AlertTriangle } from "lucide-react";

interface OpsReportBuilderPanelProps {
  order: Order;
  onRefresh: () => void;
}

export function OpsReportBuilderPanel({ order, onRefresh }: OpsReportBuilderPanelProps) {
  const { toast } = useToast();

  const [submissionOpen, setSubmissionOpen] = useState(true);
  const [reportOpen, setReportOpen] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(true);
  const [payoutOpen, setPayoutOpen] = useState(true);

  const [submission, setSubmission] = useState<RideCheckerRawSubmission | null>(null);
  const [assignment, setAssignment] = useState<RideCheckerJobAssignment | null>(null);
  const [submissionLoading, setSubmissionLoading] = useState(true);

  const [severity, setSeverity] = useState(order.ops_severity_overall || "");
  const [summary, setSummary] = useState(order.ops_summary || "");
  const [reportUrl, setReportUrl] = useState(order.ops_report_url || "");
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const [approvingSubmission, setApprovingSubmission] = useState(false);
  const [rejectingSubmission, setRejectingSubmission] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [markingPaid, setMarkingPaid] = useState(false);

  useEffect(() => {
    fetchSubmission();
  }, [order.id]);

  useEffect(() => {
    setSeverity(order.ops_severity_overall || "");
    setSummary(order.ops_summary || "");
    setReportUrl(order.ops_report_url || "");
  }, [order.ops_severity_overall, order.ops_summary, order.ops_report_url]);

  async function fetchSubmission() {
    setSubmissionLoading(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/raw-submission`);
      if (res.ok) {
        const data = await res.json();
        setSubmission(data.submission || null);
        setAssignment(data.assignment || null);
      }
    } catch {
      // silently fail
    } finally {
      setSubmissionLoading(false);
    }
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/report/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ops_severity_overall: severity || undefined,
          ops_summary: summary || undefined,
          ops_report_url: reportUrl || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Draft saved" });
      onRefresh();
    } catch {
      toast({ title: "Failed to save draft", variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSendReport() {
    setSendingReport(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/report/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Report sent" });
      onRefresh();
    } catch {
      toast({ title: "Failed to send report", variant: "destructive" });
    } finally {
      setSendingReport(false);
    }
  }

  async function handleApproveSubmission() {
    setApprovingSubmission(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/approve-submission`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      const data = await res.json();
      toast({
        title: "Submission approved",
        description: `Score: ${data.score ?? "N/A"} | Payout: $${data.payout_amount ? (data.payout_amount / 100).toFixed(2) : "N/A"}`,
      });
      fetchSubmission();
      onRefresh();
    } catch {
      toast({ title: "Failed to approve", variant: "destructive" });
    } finally {
      setApprovingSubmission(false);
    }
  }

  async function handleRejectSubmission() {
    if (!rejectReason.trim()) return;
    setRejectingSubmission(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/reject-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Submission rejected" });
      setShowRejectInput(false);
      setRejectReason("");
      fetchSubmission();
      onRefresh();
    } catch {
      toast({ title: "Failed to reject", variant: "destructive" });
    } finally {
      setRejectingSubmission(false);
    }
  }

  async function handleMarkPaid() {
    if (!assignment) return;
    setMarkingPaid(true);
    try {
      const res = await fetch(`/api/ops/payouts/${assignment.id}/mark-paid`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Marked as paid" });
      fetchSubmission();
      onRefresh();
    } catch {
      toast({ title: "Failed to mark paid", variant: "destructive" });
    } finally {
      setMarkingPaid(false);
    }
  }

  const photoLinks = submission
    ? [
        { label: "VIN Photo", url: submission.vin_photo_url },
        { label: "Odometer", url: submission.odometer_photo_url },
        { label: "Under Hood", url: submission.under_hood_photo_url },
        { label: "Undercarriage", url: submission.undercarriage_photo_url },
      ]
    : [];

  const tireTreads = submission
    ? [
        { label: "Front Left", value: submission.tire_tread_mm_front_left },
        { label: "Front Right", value: submission.tire_tread_mm_front_right },
        { label: "Rear Left", value: submission.tire_tread_mm_rear_left },
        { label: "Rear Right", value: submission.tire_tread_mm_rear_right },
      ]
    : [];

  const textSections = submission
    ? [
        { label: "Cosmetic / Exterior", value: submission.cosmetic_exterior },
        { label: "Interior Condition", value: submission.interior_condition },
        { label: "Mechanical Issues", value: submission.mechanical_issues },
        { label: "Test Drive Notes", value: submission.test_drive_notes },
        { label: "Immediate Concerns", value: submission.immediate_concerns },
      ]
    : [];

  const showReviewSection =
    submission && assignment && (assignment.status === "submitted" || assignment.status === "approved");

  const showPayoutSection = assignment && assignment.payout_amount;

  return (
    <Card data-testid="ops-report-builder-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Ops Report Builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section 1: Raw Submission Viewer */}
        <div className="space-y-3">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium cursor-pointer"
            onClick={() => setSubmissionOpen(!submissionOpen)}
            data-testid="toggle-submission-viewer"
          >
            <Camera className="h-4 w-4 text-muted-foreground" />
            Raw Submission Data
            <span className="text-xs text-muted-foreground">{submissionOpen ? "[-]" : "[+]"}</span>
          </button>

          {submissionOpen && (
            <div className="space-y-4 pl-6">
              {submissionLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : !submission ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-submission">
                  No raw data submission yet
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Photos</Label>
                    <div className="flex items-center gap-3 flex-wrap">
                      {photoLinks.map((p) =>
                        p.url ? (
                          <a
                            key={p.label}
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline"
                            data-testid={`link-photo-${p.label.toLowerCase().replace(/\s/g, "-")}`}
                          >
                            {p.label}
                          </a>
                        ) : (
                          <span key={p.label} className="text-xs text-muted-foreground">
                            {p.label}: N/A
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {submission.extra_photos && submission.extra_photos.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Extra Photos</Label>
                      <div className="flex items-center gap-3 flex-wrap">
                        {submission.extra_photos.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline"
                            data-testid={`link-extra-photo-${i}`}
                          >
                            Extra #{i + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Tire Tread Depths (mm)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {tireTreads.map((t) => (
                        <div
                          key={t.label}
                          className="flex justify-between text-sm p-2 rounded-md border"
                          data-testid={`tread-${t.label.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <span className="text-muted-foreground">{t.label}</span>
                          <span className="font-medium">{t.value !== null ? `${t.value}mm` : "N/A"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Brake Condition</Label>
                      <div>
                        <Badge
                          variant={submission.brake_condition === "good" ? "default" : submission.brake_condition === "poor" ? "destructive" : "secondary"}
                          className="no-default-hover-elevate no-default-active-elevate"
                          data-testid="badge-brake-condition"
                        >
                          {submission.brake_condition || "Unknown"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {submission.scan_codes && submission.scan_codes.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Scan Codes</Label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {submission.scan_codes.map((code, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="no-default-hover-elevate no-default-active-elevate"
                            data-testid={`badge-scan-code-${i}`}
                          >
                            {code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {textSections.map((s) => (
                      <div key={s.label} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{s.label}</Label>
                        <Textarea
                          value={s.value || ""}
                          readOnly
                          rows={3}
                          className="text-sm"
                          data-testid={`textarea-${s.label.toLowerCase().replace(/[\s\/]/g, "-")}`}
                        />
                      </div>
                    ))}
                  </div>

                  {submission.audio_note_url && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Audio Note</Label>
                      <a
                        href={submission.audio_note_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline"
                        data-testid="link-audio-note"
                      >
                        Listen to Audio Note
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-4 flex-wrap text-sm">
                    <div>
                      <span className="text-muted-foreground">Submitted: </span>
                      <span className="font-medium" data-testid="text-submission-timestamp">
                        {new Date(submission.submitted_at).toLocaleString()}
                      </span>
                    </div>
                    {assignment && (
                      <>
                        <Badge
                          variant="outline"
                          className="no-default-hover-elevate no-default-active-elevate"
                          data-testid="badge-assignment-status"
                        >
                          {assignment.status}
                        </Badge>
                        {assignment.job_score !== null && (
                          <span data-testid="text-job-score">
                            Score: <strong>{assignment.job_score}</strong>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Report Builder */}
        <div className="space-y-3 border-t pt-4">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium cursor-pointer"
            onClick={() => setReportOpen(!reportOpen)}
            data-testid="toggle-report-builder"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            Report Builder
            <span className="text-xs text-muted-foreground">{reportOpen ? "[-]" : "[+]"}</span>
          </button>

          {reportOpen && (
            <div className="space-y-4 pl-6">
              <div className="space-y-2">
                <Label className="text-xs">Overall Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger data-testid="select-severity">
                    <SelectValue placeholder="Select severity..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="safety_critical">Safety Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Summary (required)</Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Write the ops summary..."
                  rows={5}
                  data-testid="input-ops-summary"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Report URL (optional)</Label>
                <Input
                  value={reportUrl}
                  onChange={(e) => setReportUrl(e.target.value)}
                  placeholder="https://..."
                  data-testid="input-report-url"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                  data-testid="button-save-draft"
                >
                  {savingDraft ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  onClick={handleSendReport}
                  disabled={sendingReport}
                  data-testid="button-send-report"
                >
                  {sendingReport ? "Sending..." : "Send Report"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Submission Review Actions */}
        {showReviewSection && (
          <div className="space-y-3 border-t pt-4">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium cursor-pointer"
              onClick={() => setReviewOpen(!reviewOpen)}
              data-testid="toggle-review-actions"
            >
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Submission Review
              <span className="text-xs text-muted-foreground">{reviewOpen ? "[-]" : "[+]"}</span>
            </button>

            {reviewOpen && (
              <div className="space-y-3 pl-6">
                {assignment!.status === "approved" ? (
                  <div className="space-y-2" data-testid="approved-info">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="no-default-hover-elevate no-default-active-elevate" data-testid="badge-approved">
                        Approved
                      </Badge>
                      {assignment!.job_score !== null && (
                        <span className="text-sm" data-testid="text-approved-score">
                          Score: <strong>{assignment!.job_score}</strong>
                        </span>
                      )}
                      {assignment!.payout_amount !== null && (
                        <span className="text-sm" data-testid="text-approved-payout">
                          Payout: <strong>${(assignment!.payout_amount! / 100).toFixed(2)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 flex-wrap">
                    <Button
                      onClick={handleApproveSubmission}
                      disabled={approvingSubmission}
                      data-testid="button-approve-submission"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {approvingSubmission ? "Approving..." : "Approve Submission"}
                    </Button>

                    {!showRejectInput ? (
                      <Button
                        variant="destructive"
                        onClick={() => setShowRejectInput(true)}
                        data-testid="button-reject-submission"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject Submission
                      </Button>
                    ) : (
                      <div className="flex-1 min-w-[200px] space-y-2">
                        <Textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection..."
                          rows={2}
                          data-testid="input-reject-reason"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            variant="destructive"
                            onClick={handleRejectSubmission}
                            disabled={rejectingSubmission || !rejectReason.trim()}
                            data-testid="button-confirm-reject"
                          >
                            {rejectingSubmission ? "Rejecting..." : "Confirm Reject"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowRejectInput(false);
                              setRejectReason("");
                            }}
                            data-testid="button-cancel-reject"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 4: Payout Status */}
        {showPayoutSection && (
          <div className="space-y-3 border-t pt-4">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium cursor-pointer"
              onClick={() => setPayoutOpen(!payoutOpen)}
              data-testid="toggle-payout-status"
            >
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Payout Status
              <span className="text-xs text-muted-foreground">{payoutOpen ? "[-]" : "[+]"}</span>
            </button>

            {payoutOpen && (
              <div className="space-y-3 pl-6">
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <span data-testid="text-payout-amount">
                    Amount: <strong>${(assignment!.payout_amount! / 100).toFixed(2)}</strong>
                  </span>
                  <Badge
                    variant={assignment!.payout_status === "released" ? "default" : assignment!.payout_status === "failed" ? "destructive" : "secondary"}
                    className="no-default-hover-elevate no-default-active-elevate"
                    data-testid="badge-payout-status"
                  >
                    {assignment!.payout_status}
                  </Badge>
                </div>

                {assignment!.payout_status === "pending" && (
                  <Button
                    variant="outline"
                    onClick={handleMarkPaid}
                    disabled={markingPaid}
                    data-testid="button-mark-paid"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    {markingPaid ? "Processing..." : "Mark Paid"}
                  </Button>
                )}

                {assignment!.payout_status === "released" && assignment!.paid_at && (
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Badge className="no-default-hover-elevate no-default-active-elevate" data-testid="badge-paid">
                      Paid
                    </Badge>
                    <span className="text-muted-foreground" data-testid="text-paid-at">
                      {new Date(assignment!.paid_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
