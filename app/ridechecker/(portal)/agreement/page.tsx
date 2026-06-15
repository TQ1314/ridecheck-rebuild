"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ScrollText,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  CURRENT_AGREEMENT_VERSION,
  CURRENT_AGREEMENT_TITLE,
  AGREEMENT_TEXT,
} from "@/lib/agreements/rccpa-v1-2026-06";

export default function RideCheckerAgreementPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [signedName, setSignedName]     = useState("");
  const [confirmed, setConfirmed]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [done, setDone]                 = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ridechecker/agreement/status");
        if (res.ok) {
          const data = await res.json();
          if (data.has_signed_current) {
            setAlreadySigned(true);
          }
        }
      } catch { /* ignore */ }
      finally { setCheckingStatus(false); }
    })();
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setScrolledToBottom(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedName.trim()) {
      toast({ title: "Enter your legal name", variant: "destructive" });
      return;
    }
    if (!confirmed) {
      toast({ title: "You must check the agreement checkbox", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/ridechecker/agreement/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signed_name: signedName.trim(), confirmed: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = typeof data.error === "object"
          ? Object.values(data.error).flat().join(", ")
          : data.error || "Signing failed";
        toast({ title: "Error", description: msg, variant: "destructive" });
        return;
      }

      setDone(true);
      toast({ title: "Agreement signed!", description: "You can now receive RideCheck assignments." });
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingStatus) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (done || alreadySigned) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
              <h2 className="text-2xl font-bold text-green-900 dark:text-green-200">
                {done ? "Agreement Signed!" : "Agreement Already Signed"}
              </h2>
              <p className="text-green-700 dark:text-green-300">
                {done
                  ? "Your contractor agreement has been recorded. You are now eligible to receive RideCheck assignments."
                  : `You have already signed the current agreement (${CURRENT_AGREEMENT_VERSION}). No action needed.`}
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-green-600 dark:text-green-400">
                <Shield className="h-3.5 w-3.5" />
                <span>{CURRENT_AGREEMENT_VERSION}</span>
              </div>
              <Button
                onClick={() => router.push("/ridechecker/dashboard")}
                className="mt-2"
                data-testid="button-go-to-dashboard"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold" data-testid="text-agreement-title">
              Contractor Agreement
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Review and sign the agreement below before receiving RideCheck assignments.
          </p>
        </div>

        {/* Action Required notice */}
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                Action Required: Contractor Agreement
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Before receiving RideCheck assignments, you must review and accept the current
                RideCheck Independent Contractor Compensation &amp; Performance Agreement.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Agreement document */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {CURRENT_AGREEMENT_TITLE}
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono">
                  {CURRENT_AGREEMENT_VERSION}
                </Badge>
              </div>
              {!scrolledToBottom && (
                <span className="text-xs text-muted-foreground italic self-end">
                  Scroll to read the full agreement
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="h-[420px] overflow-y-auto border-t border-b bg-muted/30 dark:bg-muted/10 px-5 py-4"
              data-testid="div-agreement-text"
            >
              <pre
                className="text-xs text-foreground/80 font-mono whitespace-pre-wrap leading-relaxed"
                style={{ fontFamily: "inherit", fontSize: "0.72rem" }}
              >
                {AGREEMENT_TEXT}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Signature form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Electronic Signature</CardTitle>
              <p className="text-xs text-muted-foreground">
                By entering your legal name and checking the box below, you are electronically
                signing this agreement.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">

              <div className="space-y-2">
                <Label htmlFor="signed-name" className="font-medium">
                  Your Legal Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="signed-name"
                  placeholder="Enter your full legal name"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  disabled={submitting}
                  data-testid="input-signed-name"
                  className="max-w-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Must match your legal name as it appears on your government-issued ID.
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                <Checkbox
                  id="confirmed"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(!!v)}
                  disabled={submitting}
                  data-testid="checkbox-agreement-confirmed"
                  className="mt-0.5"
                />
                <Label
                  htmlFor="confirmed"
                  className="text-sm leading-snug cursor-pointer font-normal"
                >
                  I have read and agree to the{" "}
                  <strong>RideCheck Independent Contractor Compensation &amp; Performance Agreement</strong>{" "}
                  (version {CURRENT_AGREEMENT_VERSION}). I understand that this constitutes a legally
                  binding electronic signature.
                </Label>
              </div>

              {!scrolledToBottom && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  Please scroll through the full agreement above before signing.
                </p>
              )}

              <Button
                type="submit"
                disabled={submitting || !signedName.trim() || !confirmed}
                className="w-full sm:w-auto"
                data-testid="button-sign-agreement"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Sign Agreement
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Your signature, name, timestamp, and IP address will be recorded for legal compliance.
              </p>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppShell>
  );
}
