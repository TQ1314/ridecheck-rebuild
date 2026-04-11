"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Wrench, Gift } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/hooks/use-toast";

export default function RideCheckerSignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <RideCheckerSignupInner />
    </Suspense>
  );
}

function RideCheckerSignupInner() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [fullName, setFullName]     = useState("");
  const [email, setEmail]           = useState("");
  const [phone, setPhone]           = useState("");
  const [city, setCity]             = useState("");
  const [experience, setExperience] = useState("");
  const [notes, setNotes]           = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading]       = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref);
  }, [searchParams]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/ridechecker/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: phone || null,
          city: city || null,
          experience: experience || null,
          notes: notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      setSubmitted(true);
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/5 via-background to-muted/30">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-bold">Application received!</h2>
            <p className="text-sm text-muted-foreground">
              Thanks for applying to be a RideChecker. Our team will review your application and reach out to{" "}
              <strong>{email}</strong> within a few business days.
            </p>
            <p className="text-xs text-muted-foreground">
              No account is created yet. You will receive a setup link by email once approved.
            </p>
            <Link href="/">
              <Button variant="outline" className="mt-2 w-full" data-testid="link-home-after-apply">
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/5 via-background to-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4" data-testid="link-home">
            <Logo size={36} />
            <span className="text-2xl font-bold">RideCheck</span>
          </Link>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Become a RideChecker</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Apply to join our network of vehicle assessment professionals.
            If approved, you will receive an email with a link to set up your account.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleApply} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                data-testid="input-full-name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
              />
            </div>
            <div>
              <Label htmlFor="city">City / Area</Label>
              <Input
                id="city"
                placeholder="e.g. Waukegan, IL"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                data-testid="input-city"
              />
            </div>
            <div>
              <Label htmlFor="experience">Relevant Experience</Label>
              <Textarea
                id="experience"
                placeholder="Briefly describe your automotive assessment experience..."
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="resize-none"
                rows={3}
                data-testid="input-experience"
              />
            </div>
            <div>
              <Label htmlFor="notes">Anything else you want us to know?</Label>
              <Textarea
                id="notes"
                placeholder="Optional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
                rows={2}
                data-testid="input-notes"
              />
            </div>
            {referralCode && (
              <div>
                <Label htmlFor="referralCode">
                  <span className="flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5" />
                    Referral Code
                  </span>
                </Label>
                <Input
                  id="referralCode"
                  value={referralCode}
                  readOnly
                  className="font-mono bg-muted"
                  data-testid="input-referral-code"
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="button-apply"
            >
              {loading ? "Submitting..." : "Submit Application"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary hover:underline font-medium" data-testid="link-login">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
