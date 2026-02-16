"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils/format";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Car,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface OrderEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
}

export default function QAReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<any>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [qaNotes, setQaNotes] = useState("");

  async function loadOrder() {
    const res = await fetch(`/api/qa/review/${orderId}`);
    if (!res.ok) {
      toast({ title: "Order not found", variant: "destructive" });
      router.push("/qa/review");
      return;
    }
    const data = await res.json();
    setOrder(data.order);
    setReportUrl(data.reportUrl);
    setEvents(data.events || []);
    setQaNotes(data.order.qa_notes || "");
    setLoading(false);
  }

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId]);

  const handleReview = async (status: "approved" | "revision_needed") => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/qa/review/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qa_status: status,
          qa_notes: qaNotes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit review");
      }
      toast({
        title: status === "approved" ? "Report approved" : "Revision requested",
      });
      loadOrder();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) return null;

  const isReviewed = order.qa_status === "approved" || order.qa_status === "revision_needed";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/qa/review" data-testid="link-back-qa">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-qa-order-title">
            QA Review: {order.order_id}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Vehicle Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span>
                {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
              </span>
            </div>
            {order.vehicle_vin && (
              <div>
                <span className="text-muted-foreground">VIN: </span>
                <span className="font-mono">{order.vehicle_vin}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Package: </span>
              <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate capitalize">
                {order.package}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Status: </span>
              <Badge
                variant={order.report_status === "approved" ? "default" : "secondary"}
                className="no-default-hover-elevate no-default-active-elevate"
              >
                {order.report_status}
              </Badge>
            </div>
            {order.report_uploaded_at && (
              <div>
                <span className="text-muted-foreground">Uploaded: </span>
                <span>{formatDate(order.report_uploaded_at)}</span>
              </div>
            )}
            {reportUrl && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-view-report"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Report
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Review Decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">QA Notes</Label>
            <Textarea
              value={qaNotes}
              onChange={(e) => setQaNotes(e.target.value)}
              placeholder="Add feedback or notes for the inspector..."
              className="resize-none"
              rows={4}
              data-testid="textarea-qa-notes"
            />
          </div>
          {isReviewed && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
              {order.qa_status === "approved" ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {order.qa_status === "approved"
                    ? "Report Approved"
                    : "Revision Requested"}
                </p>
                {order.qa_reviewed_at && (
                  <p className="text-xs text-muted-foreground">
                    Reviewed {formatDate(order.qa_reviewed_at)}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              onClick={() => handleReview("approved")}
              disabled={submitting}
              data-testid="button-qa-approve"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {submitting ? "Submitting..." : "Approve"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReview("revision_needed")}
              disabled={submitting}
              data-testid="button-qa-revision"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Request Revision
            </Button>
          </div>
        </CardContent>
      </Card>

      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 text-sm"
                  data-testid={`event-${event.id}`}
                >
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p>{event.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(event.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
