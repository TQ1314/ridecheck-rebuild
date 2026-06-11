"use client";

import { useState, useEffect, useCallback } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  FileText,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Send,
  ShieldCheck,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Eye,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GeneratedReport {
  id: string | null;
  order_id: string;
  order_number: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  report_storage_path: string | null;
  report_url: string | null;
  report_status: string;
  generated_by: string | null;
  qa_approved_by: string | null;
  qa_approved_at: string | null;
  delivered_by: string | null;
  delivered_at: string | null;
  report_logic_version: string | null;
  created_at: string | null;
}

interface ReportPanelProps {
  order: Order;
  onRefresh: () => void;
}

function reportStatusBadge(status: string | undefined) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800 border-green-200 no-default-hover-elevate no-default-active-elevate">QA Approved</Badge>;
    case "generated":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 no-default-hover-elevate no-default-active-elevate">Generated</Badge>;
    case "pending_review":
    case "in_review":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 no-default-hover-elevate no-default-active-elevate">Pending QA</Badge>;
    case "revision_requested":
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200 no-default-hover-elevate no-default-active-elevate">Revision Needed</Badge>;
    case "delivered":
      return <Badge className="bg-green-100 text-green-800 border-green-200 no-default-hover-elevate no-default-active-elevate">Delivered</Badge>;
    default:
      return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">No Report</Badge>;
  }
}

function genReportStatusBadge(status: string) {
  switch (status) {
    case "qa_approved":
      return <Badge className="bg-green-100 text-green-800 border-green-200 no-default-hover-elevate no-default-active-elevate"><ShieldCheck className="h-3 w-3 mr-1" />QA Approved</Badge>;
    case "qa_pending":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 no-default-hover-elevate no-default-active-elevate"><Clock className="h-3 w-3 mr-1" />Awaiting QA</Badge>;
    case "delivered":
      return <Badge className="bg-green-100 text-green-800 border-green-200 no-default-hover-elevate no-default-active-elevate"><CheckCircle2 className="h-3 w-3 mr-1" />Delivered</Badge>;
    case "superseded":
      return <Badge variant="outline" className="text-muted-foreground no-default-hover-elevate no-default-active-elevate">Superseded</Badge>;
    default:
      return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">{status}</Badge>;
  }
}

export function ReportPanel({ order, onRefresh }: ReportPanelProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [qaApproving, setQaApproving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [genReport, setGenReport] = useState<GeneratedReport | null>(null);
  const [isLegacy, setIsLegacy] = useState(false);
  const [reportLoading, setReportLoading] = useState(true);

  const fetchGenReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/generated-report`);
      if (res.ok) {
        const data = await res.json();
        setGenReport(data.report ?? null);
        setIsLegacy(data.isLegacy ?? false);
      }
    } catch {
      // silently fail
    } finally {
      setReportLoading(false);
    }
  }, [order.id]);

  useEffect(() => {
    fetchGenReport();
  }, [fetchGenReport]);

  // Derive display values
  const reportUrl = genReport?.report_url || order.ops_report_url || null;
  const hasStoredReport = !!(genReport?.report_storage_path || order.report_storage_path);
  const hasReport = !!reportUrl || hasStoredReport;

  const buyerEmail = genReport?.buyer_email || (order as any).buyer_email || order.customer_email || null;
  const buyerName = genReport?.buyer_name || order.customer_name || null;
  const vehicleLabel = [
    genReport?.vehicle_year || order.vehicle_year,
    genReport?.vehicle_make || order.vehicle_make,
    genReport?.vehicle_model || order.vehicle_model,
  ]
    .filter(Boolean)
    .join(" ");

  // QA status from generated_reports (preferred) or legacy orders.report_status
  const qaStatus = genReport?.report_status ?? null;
  const isQaApproved =
    qaStatus === "qa_approved" ||
    qaStatus === "delivered" ||
    order.report_status === "approved" ||
    order.report_status === "generated" ||
    order.report_status === "report_ready";

  const alreadyDelivered =
    qaStatus === "delivered" ||
    order.report_status === "delivered" ||
    !!order.report_delivered_at;

  const canDeliver = hasReport && isQaApproved;

  // Show QA approve button when report exists but not yet approved
  const showQaApprove =
    hasReport &&
    genReport !== null &&
    (qaStatus === "qa_pending" || (!genReport.id && !isQaApproved));

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/generate-report`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Report generation failed", description: data.error, variant: "destructive" });
        return;
      }
      const verdict = data.verdict?.replace(/_/g, " ")?.toUpperCase() ?? "";
      toast({ title: "Report generated!", description: verdict ? `Verdict: ${verdict}` : undefined });
      await fetchGenReport();
      onRefresh();
    } catch {
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleQaApprove() {
    setQaApproving(true);
    try {
      const body: Record<string, string> = {};
      if (genReport?.id) body.report_id = genReport.id;

      const res = await fetch(`/api/admin/orders/${order.id}/report/qa-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "QA approval failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Report QA approved", description: "You can now send this report to the buyer." });
      await fetchGenReport();
      onRefresh();
    } catch {
      toast({ title: "QA approval failed", variant: "destructive" });
    } finally {
      setQaApproving(false);
    }
  }

  async function handleDeliver() {
    setDelivering(true);
    setConfirmOpen(false);
    try {
      const body: Record<string, string> = {};
      if (genReport?.id) body.confirmed_report_id = genReport.id;

      const res = await fetch(`/api/admin/orders/${order.id}/deliver-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Delivery failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Report sent to buyer!" });
      await fetchGenReport();
      onRefresh();
    } catch {
      toast({ title: "Delivery failed", variant: "destructive" });
    } finally {
      setDelivering(false);
    }
  }

  return (
    <>
      <Card data-testid="card-report-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Intelligence Report
            </span>
            {reportStatusBadge(order.report_status)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* QA / submission status */}
          {order.qa_status && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>QA: <span className="font-medium text-foreground">{order.qa_status.replace(/_/g, " ")}</span></span>
            </div>
          )}

          {/* Verdict */}
          {order.ops_severity_overall && (
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-muted-foreground">Verdict:</span>
              <span className="font-semibold uppercase tracking-wide">
                {order.ops_severity_overall.replace(/_/g, " ")}
              </span>
            </div>
          )}

          {/* Generated report safety info */}
          {reportLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking report status…
            </div>
          ) : genReport ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1.5" data-testid="generated-report-info">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-medium text-foreground">Report Record</span>
                {genReportStatusBadge(genReport.report_status)}
              </div>
              {genReport.id && (
                <div className="text-xs text-muted-foreground font-mono truncate" data-testid="text-report-id">
                  ID: {genReport.id}
                </div>
              )}
              {isLegacy && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  Legacy report — pre-migration
                </div>
              )}
              {genReport.qa_approved_at && (
                <div className="text-xs text-green-700 dark:text-green-400">
                  Approved {new Date(genReport.qa_approved_at).toLocaleString()}
                </div>
              )}
            </div>
          ) : null}

          {/* Report exists — show view + actions */}
          {hasReport ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Report ready</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {reportUrl && (
                  <a href={reportUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5 h-8" data-testid="button-view-pdf">
                      <FileText className="h-3.5 w-3.5" />
                      View PDF
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </Button>
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="h-8 text-muted-foreground text-xs"
                  data-testid="button-regenerate"
                >
                  {generating ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Generating…</>
                  ) : (
                    "Regenerate"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchGenReport}
                  className="h-8 text-muted-foreground text-xs"
                  data-testid="button-refresh-report"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                RideChecker must submit findings before generating.
              </p>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
                className="w-full gap-2"
                data-testid="button-generate-report"
              >
                {generating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" />Generate AI Report</>
                )}
              </Button>
              {generating && (
                <p className="text-xs text-muted-foreground text-center">
                  Analyzing with Claude AI — ~15–30 seconds
                </p>
              )}
            </div>
          )}

          {/* QA approval action */}
          {showQaApprove && (
            <div className="pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
                onClick={handleQaApprove}
                disabled={qaApproving}
                data-testid="button-qa-approve"
              >
                {qaApproving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Approving…</>
                ) : (
                  <><ShieldCheck className="h-3.5 w-3.5" />QA Approve Report</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-1.5">
                Senior ops / admin only. Required before sending to buyer.
              </p>
            </div>
          )}

          {/* Send to buyer */}
          {hasReport && (
            <div className="pt-2 border-t space-y-2">
              {buyerEmail ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Send className="h-3 w-3" />
                  Will send to: <span className="font-medium text-foreground">{buyerEmail}</span>
                </p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  No buyer email on file — report cannot be emailed.
                </p>
              )}

              {!isQaApproved && !reportLoading && (
                <div className="flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  QA approval required before sending.
                </div>
              )}

              <Button
                size="sm"
                className="w-full gap-2"
                onClick={() => setConfirmOpen(true)}
                disabled={delivering || !canDeliver}
                variant={alreadyDelivered ? "outline" : "default"}
                data-testid="button-send-to-buyer"
              >
                {delivering ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>
                ) : (
                  <><Send className="h-3.5 w-3.5" />{alreadyDelivered ? "Resend to Buyer" : "Send to Buyer"}</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid="dialog-confirm-delivery">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Confirm Report Delivery
            </DialogTitle>
            <DialogDescription>
              Please verify the details below before sending. This action sends an email to the buyer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Recipient */}
            <div className="rounded-md border bg-muted/30 divide-y">
              <div className="flex justify-between px-3 py-2 text-sm">
                <span className="text-muted-foreground font-medium">Recipient</span>
                <span className="font-semibold text-foreground" data-testid="text-confirm-buyer-email">
                  {buyerEmail ?? "No email on file"}
                </span>
              </div>
              {buyerName && (
                <div className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-muted-foreground font-medium">Buyer</span>
                  <span data-testid="text-confirm-buyer-name">{buyerName}</span>
                </div>
              )}
              <div className="flex justify-between px-3 py-2 text-sm">
                <span className="text-muted-foreground font-medium">Order</span>
                <span className="font-mono text-xs" data-testid="text-confirm-order-number">
                  {genReport?.order_number || (order as any).order_id || order.id}
                </span>
              </div>
              {vehicleLabel && (
                <div className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-muted-foreground font-medium">Vehicle</span>
                  <span data-testid="text-confirm-vehicle">{vehicleLabel}</span>
                </div>
              )}
              {genReport?.id && (
                <div className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-muted-foreground font-medium">Report ID</span>
                  <span className="font-mono text-xs truncate max-w-[200px]" data-testid="text-confirm-report-id">
                    {genReport.id}
                  </span>
                </div>
              )}
              <div className="flex justify-between px-3 py-2 text-sm">
                <span className="text-muted-foreground font-medium">QA Status</span>
                <span data-testid="text-confirm-qa-status">
                  {genReport ? genReportStatusBadge(genReport.report_status) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 no-default-hover-elevate no-default-active-elevate">Legacy</Badge>
                  )}
                </span>
              </div>
            </div>

            {alreadyDelivered && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                This report was already sent. Confirming will resend it to the buyer.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {reportUrl && (
              <a href={reportUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-confirm-preview">
                  <Eye className="h-3.5 w-3.5" />
                  Preview Report
                </Button>
              </a>
            )}
            <Button variant="outline" onClick={() => setConfirmOpen(false)} data-testid="button-confirm-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleDeliver}
              disabled={delivering}
              className="gap-2"
              data-testid="button-confirm-send"
            >
              {delivering ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>
              ) : (
                <><Send className="h-3.5 w-3.5" />Confirm Send</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
