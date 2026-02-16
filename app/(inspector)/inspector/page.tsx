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
  MapPin,
  Calendar,
  Car,
  ArrowRight,
  ClipboardCheck,
  Clock,
} from "lucide-react";

interface InspectorJob {
  id: string;
  order_id: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_vin: string;
  package: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  inspection_address: string | null;
  inspector_status: string | null;
  report_status: string | null;
  ops_status: string;
  created_at: string;
}

function getStatusBadge(status: string | null) {
  if (!status) return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">Not Started</Badge>;
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    en_route: { label: "En Route", variant: "secondary" },
    on_site: { label: "On Site", variant: "default" },
    inspecting: { label: "Inspecting", variant: "default" },
    wrapping_up: { label: "Wrapping Up", variant: "secondary" },
    completed: { label: "Completed", variant: "outline" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant} className="no-default-hover-elevate no-default-active-elevate">{info.label}</Badge>;
}

function getReportBadge(status: string | null) {
  if (!status) return null;
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending_upload: { label: "Upload Needed", variant: "destructive" },
    uploaded: { label: "Uploaded", variant: "secondary" },
    in_review: { label: "In QA Review", variant: "secondary" },
    approved: { label: "Approved", variant: "default" },
    revision_needed: { label: "Revision Needed", variant: "destructive" },
    delivered: { label: "Delivered", variant: "outline" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant} className="no-default-hover-elevate no-default-active-elevate">{info.label}</Badge>;
}

export default function InspectorDashboard() {
  const [jobs, setJobs] = useState<InspectorJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/inspector/jobs")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
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

  const activeJobs = jobs.filter((j) => j.inspector_status !== "completed");
  const completedJobs = jobs.filter((j) => j.inspector_status === "completed");
  const needingUpload = jobs.filter((j) => j.report_status === "pending_upload");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-inspector-title">
          RideChecker Portal
        </h1>
        <p className="text-sm text-muted-foreground">
          View your assigned assessments and update status
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Jobs
            </CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-count">
              {activeJobs.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reports to Upload
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-upload-count">
              {needingUpload.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completed-count">
              {completedJobs.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Car className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-base font-semibold mb-1">No Assigned Jobs</h3>
            <p className="text-sm text-muted-foreground">
              You have no assessments assigned to you yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Assessments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Report</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id} data-testid={`row-job-${job.order_id}`}>
                      <TableCell className="font-mono text-xs">
                        {job.order_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {job.vehicle_year} {job.vehicle_make} {job.vehicle_model}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate capitalize">
                          {job.package}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {job.scheduled_date ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>{formatDate(job.scheduled_date)}</span>
                            {job.scheduled_time && (
                              <span className="text-muted-foreground">
                                {job.scheduled_time}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">TBD</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px]">
                        {job.inspection_address ? (
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="truncate">{job.inspection_address}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(job.inspector_status)}</TableCell>
                      <TableCell>{getReportBadge(job.report_status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            href={`/inspector/jobs/${job.order_id}`}
                            data-testid={`link-job-${job.order_id}`}
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
