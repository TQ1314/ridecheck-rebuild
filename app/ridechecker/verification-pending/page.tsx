"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/layout/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Clock, CheckCircle2, Loader2 } from "lucide-react";

export default function VerificationPendingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadStatus() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, verification_status")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile?.verification_status === "active" || profile?.role === "ridechecker_active") {
        router.replace("/ridechecker/dashboard");
        return;
      }
      if (profile?.verification_status === "rejected") {
        router.replace("/ridechecker/verify?status=rejected");
        return;
      }
      setStatus(profile?.verification_status ?? null);
    }
    loadStatus();
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/auth/login");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, verification_status")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile?.verification_status === "active" || profile?.role === "ridechecker_active") {
      router.replace("/ridechecker/dashboard");
      return;
    }
    if (profile?.verification_status === "rejected") {
      router.replace("/ridechecker/verify?status=rejected");
      return;
    }
    setChecking(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <Logo />

        <Card>
          <CardContent className="pt-8 pb-6 space-y-5">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
            </div>

            <div>
              <h1 className="text-xl font-bold mb-2" data-testid="text-pending-title">
                Verification Under Review
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your verification has been submitted and is being reviewed by our team.
                You'll be notified by email once your account is approved.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4 text-left space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Identity documents received</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Contractor agreement accepted</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>Admin review in progress — typically 1–2 business days</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Only RideCheckers with an active, verified account can receive inspection assignments.
              You'll receive an email as soon as your account is activated.
            </p>

            <Button
              variant="outline"
              className="w-full"
              onClick={checkStatus}
              disabled={checking}
              data-testid="button-check-status"
            >
              {checking ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Check Status
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
