"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  DollarSign,
  Wallet,
  CreditCard,
  Users,
  Copy,
  Gift,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  pendingUpload: number;
}

interface EarningsSummary {
  totalEarned: number;
  pendingPayout: number;
  paidOut: number;
  totalJobs: number;
}

interface ReferralStats {
  totalReferred: number;
  qualified: number;
  pending: number;
  totalRewardEarned: number;
}

export default function RideCheckerDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    pendingUpload: 0,
  });
  const [earnings, setEarnings] = useState<EarningsSummary>({
    totalEarned: 0,
    pendingPayout: 0,
    paidOut: 0,
    totalJobs: 0,
  });
  const [referralCode, setReferralCode] = useState("");
  const [referralStats, setReferralStats] = useState<ReferralStats>({
    totalReferred: 0,
    qualified: 0,
    pending: 0,
    totalRewardEarned: 0,
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

      const fetchJobs = fetch("/api/ridechecker/jobs").then((r) => r.ok ? r.json() : null);
      const fetchEarnings = fetch("/api/ridechecker/earnings").then((r) => r.ok ? r.json() : null);
      const fetchReferrals = fetch("/api/ridechecker/referrals").then((r) => r.ok ? r.json() : null);

      const [jobsData, earningsData, referralsData] = await Promise.all([
        fetchJobs.catch(() => null),
        fetchEarnings.catch(() => null),
        fetchReferrals.catch(() => null),
      ]);

      if (jobsData?.stats) setStats(jobsData.stats);
      if (earningsData?.summary) setEarnings(earningsData.summary);
      if (referralsData) {
        if (referralsData.referralCode) setReferralCode(referralsData.referralCode);
        if (referralsData.stats) setReferralStats(referralsData.stats);
      }

      setLoading(false);
    }
    load();
  }, []);

  const copyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      toast({ title: "Referral code copied!" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const copyReferralLink = async () => {
    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${appUrl}/ridechecker/signup?ref=${referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Referral link copied!" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Earned
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-earned">
                    ${earnings.totalEarned.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending Payout
                  </CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-pending-payout">
                    ${earnings.pendingPayout.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Paid Out
                  </CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-paid-out">
                    ${earnings.paidOut.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Gift className="h-4 w-4 text-muted-foreground" />
                  Referral Program
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Refer a mechanic or technician. You both earn $100 when they complete 3 jobs within 30 days.
                </p>
                {referralCode && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">Your Code:</span>
                      <div className="flex items-center gap-1">
                        <Input
                          readOnly
                          value={referralCode}
                          className="w-48 font-mono text-sm"
                          data-testid="input-referral-code-display"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={copyReferralCode}
                          data-testid="button-copy-referral-code"
                          title="Copy code"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyReferralLink}
                      data-testid="button-copy-referral-link"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy Referral Link
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="text-center">
                    <div className="text-lg font-bold" data-testid="text-referral-total">
                      {referralStats.totalReferred}
                    </div>
                    <div className="text-xs text-muted-foreground">Referred</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold" data-testid="text-referral-pending">
                      {referralStats.pending}
                    </div>
                    <div className="text-xs text-muted-foreground">In Progress</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold" data-testid="text-referral-qualified">
                      {referralStats.qualified}
                    </div>
                    <div className="text-xs text-muted-foreground">Qualified</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold" data-testid="text-referral-reward">
                      ${referralStats.totalRewardEarned}
                    </div>
                    <div className="text-xs text-muted-foreground">Reward Earned</div>
                  </div>
                </div>
              </CardContent>
            </Card>

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

        {isPending && referralCode && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-muted-foreground" />
                Your Referral Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Share your referral code even while your account is pending. Once both of you are active and your referral completes 3 jobs in 30 days, you each earn $100.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  readOnly
                  value={referralCode}
                  className="w-48 font-mono text-sm"
                  data-testid="input-referral-code-pending"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={copyReferralCode}
                  data-testid="button-copy-referral-pending"
                  title="Copy code"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
