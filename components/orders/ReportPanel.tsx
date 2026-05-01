"use client";

import { useState } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportPanelProps {
  order: Order;
  onRefresh: () => void;
}

function reportStatusBadge(status: string | undefined) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800 border-green-200">QA Approved</Badge>;
    case "generated":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Generated</Badge>;
    case "pending_review":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending QA</Badge>;
    case "revision_requested":
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Revision Needed</Badge>;
    case "delivered":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Delivered</Badge>;
    default:
      return <Badge variant="outline">No Report</Badge>;
  }
}

export function ReportPanel({ order, onRefresh }: ReportPanelProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [delivering, setDelivering] = useState(false);

  const reportUrl = order.ops_report_url;
  const hasReport = !!reportUrl;
  const canDeliver = order.report_status === "approved" || order.report_status === "generated";
  const alreadyDelivered = order.report_status === "delivered" || !!order.report_delivered_at;

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
      onRefresh();
    } catch {
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeliver() {
    setDelivering(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/deliver-report`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Delivery failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Report sent to buyer!" });
      onRefresh();
    } catch {
      toast({ title: "Delivery failed", variant: "destructive" });
    } finally {
      setDelivering(false);
    }
  }

  return (
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

        {/* Report exists — show view + actions */}
        {hasReport ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">Report ready</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a href={reportUrl!} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 h-8" data-testid="button-view-pdf">
                  <FileText className="h-3.5 w-3.5" />
                  View PDF
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </Button>
              </a>
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

        {/* Send to buyer */}
        {hasReport && (
          <div className="pt-2 border-t">
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={handleDeliver}
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
            {!canDeliver && (
              <p className="text-xs text-muted-foreground mt-1.5 text-center">
                Requires QA approval before sending
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
