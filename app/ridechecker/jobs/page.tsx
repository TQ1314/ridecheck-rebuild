"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  MapPin,
  Calendar,
  AlertCircle,
} from "lucide-react";

interface Job {
  order_id: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_location: string;
  inspection_address: string;
  scheduled_date: string;
  scheduled_time: string;
  inspector_status: string;
  report_status: string;
  package: string;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "completed":
      return "default";
    case "en_route":
    case "on_site":
    case "inspecting":
    case "wrapping_up":
      return "secondary";
    default:
      return "outline";
  }
}

function formatStatus(status: string): string {
  if (!status) return "Pending";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RideCheckerJobsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (prof) setProfile(prof);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </AppShell>
    );
  }

  const isActive = profile?.role === "ridechecker_active";
  const isPending = profile?.role === "ridechecker";

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-jobs-title">
            My Jobs
          </h1>
          <p className="text-muted-foreground">
            Assigned vehicle assessment jobs
          </p>
        </div>

        {isPending && (
          <Card>
            <CardContent className="flex items-start gap-4 p-6">
              <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Account Pending Approval</h3>
                <p className="text-sm text-muted-foreground">
                  You will be able to see assigned jobs once your account is
                  approved and activated by the RideCheck team.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isActive && jobs.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Car className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No Jobs Assigned</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                You don't have any assessment jobs assigned yet. New jobs will
                appear here when they are assigned to you.
              </p>
            </CardContent>
          </Card>
        )}

        {isActive && jobs.length > 0 && (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card key={job.order_id} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold" data-testid={`text-job-vehicle-${job.order_id}`}>
                          {job.vehicle_year} {job.vehicle_make} {job.vehicle_model}
                        </span>
                        <Badge
                          variant={statusBadgeVariant(job.inspector_status)}
                          data-testid={`badge-job-status-${job.order_id}`}
                        >
                          {formatStatus(job.inspector_status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.inspection_address || job.vehicle_location || "TBD"}
                        </span>
                        {job.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {job.scheduled_date}
                            {job.scheduled_time ? ` at ${job.scheduled_time}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline">{job.package}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
