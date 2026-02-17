"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from "lucide-react";

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  pendingUpload: number;
}

export default function RideCheckerDashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    pendingUpload: 0,
  });
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
              RideChecker Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name || "RideChecker"}
            </p>
          </div>
          <Badge
            variant={isActive ? "default" : "secondary"}
            data-testid="badge-status"
          >
            {isActive ? "Active" : "Pending Approval"}
          </Badge>
        </div>

        {isPending && (
          <Card>
            <CardContent className="flex items-start gap-4 p-6">
              <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Account Pending Approval</h3>
                <p className="text-sm text-muted-foreground">
                  Your RideChecker application is being reviewed. Once approved,
                  you will be able to receive and complete vehicle assessment
                  jobs. We will notify you when your account is activated.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isActive && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Jobs
                  </CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-jobs">
                    {stats.totalJobs}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-active-jobs">
                    {stats.activeJobs}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Completed
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-completed-jobs">
                    {stats.completedJobs}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Needs Upload
                  </CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-pending-upload">
                    {stats.pendingUpload}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/ridechecker/jobs">
                  <Button data-testid="button-view-jobs">
                    <Briefcase className="h-4 w-4 mr-2" />
                    View My Jobs
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
