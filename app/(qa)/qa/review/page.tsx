"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils/format";
import {
  FileCheck,
  ArrowRight,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface QAOrder {
  id: string;
  order_id: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  package: string;
  report_status: string;
  report_uploaded_at: string | null;
  qa_status: string | null;
  qa_notes: string | null;
  created_at: string;
}

function getReportBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    uploaded: { label: "Pending Review", variant: "secondary" },
    in_review: { label: "In Review", variant: "default" },
    approved: { label: "Approved", variant: "default" },
    revision_needed: { label: "Revision Needed", variant: "destructive" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant} className="no-default-hover-elevate no-default-active-elevate">{info.label}</Badge>;
}

export default function QAReviewPage() {
  const [orders, setOrders] = useState<QAOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/qa/review")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const pendingReview = orders.filter((o) => o.report_status === "uploaded" || o.report_status === "in_review");
  const revisionNeeded = orders.filter((o) => o.report_status === "revision_needed");
  const approved = orders.filter((o) => o.report_status === "approved");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-qa-title">
          QA Review
        </h1>
        <p className="text-sm text-muted-foreground">
          Review uploaded reports and approve or request revisions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-count">
              {pendingReview.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revision Needed
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-revision-count">
              {revisionNeeded.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-approved-count">
              {approved.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-base font-semibold mb-1">No Reports to Review</h3>
            <p className="text-sm text-muted-foreground">
              Reports will appear here once inspectors upload them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reports Queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} data-testid={`row-qa-${order.order_id}`}>
                      <TableCell className="font-mono text-xs">
                        {order.order_id}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate capitalize">
                          {order.package}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.report_uploaded_at
                          ? formatDate(order.report_uploaded_at)
                          : "-"}
                      </TableCell>
                      <TableCell>{getReportBadge(order.report_status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            href={`/qa/review/${order.order_id}`}
                            data-testid={`link-qa-${order.order_id}`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
