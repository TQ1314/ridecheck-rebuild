"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, Clock, Mail, ArrowRight } from "lucide-react";

const TIER_LABELS: Record<string, string> = {
  backer:           "The Backer",
  believer:         "The Believer",
  founding_partner: "Founding Partner",
};

interface Credit {
  id:                    string;
  tier:                  string;
  amount_cents:          number;
  credits_count:         number;
  credit_code:           string;
  supporter_name:        string;
  supporter_email:       string;
  gift_recipient_name:   string | null;
  gift_recipient_email:  string | null;
  list_on_partners_page: boolean;
  status:                string;
  expires_at:            string;
  created_at:            string;
}

function SuccessContent() {
  const params    = useSearchParams();
  const sessionId = params.get("session_id");

  const [credit, setCredit]     = useState<Credit | null>(null);
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }

    let tries = 0;
    const maxTries = 8;

    async function poll() {
      try {
        const res = await fetch(`/api/founding/session/${sessionId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.credit) {
            setCredit(json.credit);
            setLoading(false);
            return;
          }
        }
      } catch { /* network hiccup */ }

      tries++;
      setAttempts(tries);
      if (tries < maxTries) {
        setTimeout(poll, 2000);
      } else {
        setLoading(false);
      }
    }

    poll();
  }, [sessionId]);

  function copyCode() {
    if (!credit?.credit_code) return;
    navigator.clipboard.writeText(credit.credit_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <p className="text-muted-foreground">
            No session found. If you completed a purchase, check your email for your credit code.
          </p>
          <Button asChild variant="outline">
            <Link href="/founding-supporters">Back to Campaign</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mx-auto" />
          <h2 className="text-xl font-bold">Confirming your purchase…</h2>
          <p className="text-muted-foreground text-sm">
            {attempts > 2
              ? "Still processing — almost there. Your credit code will arrive by email shortly."
              : "Please wait while we generate your credit code."}
          </p>
        </div>
      </div>
    );
  }

  if (!credit) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <Mail className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold">Payment Received!</h2>
          <p className="text-muted-foreground">
            Your credit is being processed and will arrive by email within a few minutes.
            Check your inbox — including spam just in case.
          </p>
          <p className="text-sm text-muted-foreground">
            Questions?{" "}
            <a href="mailto:support@ridecheckauto.com" className="text-emerald-600 hover:underline">
              support@ridecheckauto.com
            </a>
          </p>
          <Button asChild variant="outline">
            <Link href="/founding-supporters">Back to Campaign</Link>
          </Button>
        </div>
      </div>
    );
  }

  const expDate = new Date(credit.expires_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-emerald-600 text-white py-14 px-4 text-center">
        <CheckCircle className="h-14 w-14 mx-auto mb-4 opacity-90" />
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">You&apos;re a Founding Supporter!</h1>
        <p className="text-emerald-100 text-lg">
          Thank you, {credit.supporter_name.split(" ")[0]}. Here&apos;s your RideCheck credit.
        </p>
      </div>

      <div className="mx-auto max-w-lg px-4 py-12 space-y-6">
        {/* Credit code card */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-8 text-center">
          <Badge className="bg-emerald-700 text-white border-0 mb-4 text-xs tracking-widest">
            {TIER_LABELS[credit.tier] ?? credit.tier}
          </Badge>
          <p className="text-sm text-muted-foreground mb-2">Your Credit Code</p>
          <p
            data-testid="text-credit-code"
            className="text-3xl font-bold tracking-widest text-emerald-900 dark:text-emerald-100 font-mono mb-4"
          >
            {credit.credit_code}
          </p>
          <button
            data-testid="button-copy-code"
            onClick={copyCode}
            className="inline-flex items-center gap-2 text-sm text-emerald-700 font-medium hover:underline"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>

        {/* Details */}
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tier</span>
            <span className="font-medium">{TIER_LABELS[credit.tier] ?? credit.tier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Credits</span>
            <span className="font-medium">
              {credit.credits_count} Standard Credit{credit.credits_count > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount Paid</span>
            <span className="font-medium">${credit.amount_cents / 100}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Valid Until
            </span>
            <span className="font-medium">{expDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="outline" className="text-emerald-700 border-emerald-300">Active</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sent To</span>
            <span className="font-medium truncate max-w-[200px]">{credit.supporter_email}</span>
          </div>
        </div>

        {/* Gift notice */}
        {credit.gift_recipient_name && credit.gift_recipient_email && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
            <p className="font-semibold mb-1 text-emerald-800">Gift Sent</p>
            <p className="text-muted-foreground">
              A copy of this credit code has also been emailed to{" "}
              <strong>{credit.gift_recipient_name}</strong> at {credit.gift_recipient_email}.
            </p>
          </div>
        )}

        {/* Founding Partners notice */}
        {credit.list_on_partners_page && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
            <p className="font-semibold mb-1 text-emerald-800">Founding Partners Page</p>
            <p className="text-muted-foreground">
              Your name will appear on our{" "}
              <Link href="/founding-partners" className="text-emerald-700 hover:underline font-medium">
                Founding Partners page
              </Link>
              .
            </p>
          </div>
        )}

        {/* Next steps */}
        <div className="rounded-xl border bg-card p-5">
          <p className="font-semibold mb-3">What Happens Next</p>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Check your email — your credit code has been sent to {credit.supporter_email}.</li>
            <li>
              When you&apos;re ready, visit{" "}
              <Link href="/book" className="text-emerald-700 hover:underline">
                ridecheckauto.com/book
              </Link>{" "}
              and enter the code at checkout.
            </li>
            <li>A trained RideCheck inspector will assess the vehicle and send you a full report.</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            <Link href="/book">
              Schedule an Inspection <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/founding-partners">View Founding Partners</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function FoundingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
