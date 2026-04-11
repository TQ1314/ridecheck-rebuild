"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/layout/Logo";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Calendar,
  BookOpen,
  ChevronRight,
  Loader2,
} from "lucide-react";

const STEPS = [
  {
    icon: <BookOpen className="h-5 w-5 text-primary" />,
    title: "Complete your training",
    description: "Review the RideChecker assessment guide and inspection checklist.",
  },
  {
    icon: <Calendar className="h-5 w-5 text-primary" />,
    title: "Set your availability",
    description: "Let us know when you are available so we can assign jobs near you.",
  },
  {
    icon: <ClipboardList className="h-5 w-5 text-primary" />,
    title: "Accept your first job",
    description: "Browse open assignments in the Jobs tab and claim one to get started.",
  },
  {
    icon: <DollarSign className="h-5 w-5 text-primary" />,
    title: "Complete & earn",
    description: "Submit your assessment report and get paid after QA approval.",
  },
];

export default function RideCheckerOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        router.replace("/auth/login");
        return;
      }
      const meta = data.user.user_metadata;
      setName(meta?.full_name || data.user.email || "");
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = name.split(" ")[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo size={48} />
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <h1 className="text-2xl font-bold" data-testid="text-welcome-heading">
              Welcome to RideCheck, {firstName}!
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Your account is active. Here is what to do next.
          </p>
          <Badge className="no-default-hover-elevate no-default-active-elevate" data-testid="badge-level">
            Level 1 RideChecker
          </Badge>
        </div>

        {/* Steps */}
        <Card>
          <CardContent className="pt-6 pb-4 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Getting started
            </h2>
            <ol className="space-y-4">
              {STEPS.map((step, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-4"
                  data-testid={`step-item-${idx + 1}`}
                >
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mt-0.5">
                    {step.icon}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="space-y-3">
          <Link href="/ridechecker/dashboard" className="block" data-testid="link-go-to-dashboard">
            <Button className="w-full h-11 text-base font-semibold">
              Go to My Dashboard
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Questions? Email{" "}
            <a href="mailto:support@ridecheckauto.com" className="text-primary hover:underline">
              support@ridecheckauto.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
