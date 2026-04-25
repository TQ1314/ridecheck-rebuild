"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel, getDashboardPath, type Role } from "@/lib/utils/roles";
import { Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const token = params?.token as string;

  const [invite, setInvite] = useState<{
    id: string;
    email: string;
    role: string;
    expires_at: string;
  } | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "expired" | "used" | "not_found" | "signing_in" | "success" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        if (res.status === 410) {
          const data = await res.json();
          setStatus(data.error === "Invite already used" ? "used" : "expired");
          return;
        }
        if (!res.ok) {
          setStatus("not_found");
          return;
        }
        const data = await res.json();
        setInvite(data.invite);
        setStatus("ready");
      })
      .catch(() => setStatus("not_found"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");

    try {
      // Step 1: Create the account
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invite!.email,
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept invite");

      // Step 2: Auto sign in
      setStatus("signing_in");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invite!.email,
        password,
      });

      if (signInError) {
        // Account created but sign-in failed — send them to login with a note
        setStatus("success");
        return;
      }

      // Step 3: Redirect based on role
      // ridechecker (verification flow) → verify page
      // ridechecker_active (direct invite) → onboarding
      // all others → role dashboard
      let redirectPath: string;
      if (invite!.role === "ridechecker") {
        redirectPath = "/ridechecker/verify";
      } else if (invite!.role === "ridechecker_active") {
        redirectPath = "/ridechecker/onboarding";
      } else {
        redirectPath = getDashboardPath(invite!.role as Role);
      }
      router.push(redirectPath);
    } catch (err: any) {
      setErrorMsg(err.message);
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // ── Signing in / redirecting ──────────────────────────────────────
  if (status === "signing_in") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    );
  }

  // ── Invalid / expired / used ──────────────────────────────────────
  if (status === "not_found" || status === "expired" || status === "used") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 w-12 opacity-50"><Logo size={48} /></div>
            <h2 className="text-lg font-semibold mb-2">
              {status === "not_found" && "Invite Not Found"}
              {status === "expired" && "Invite Expired"}
              {status === "used" && "Invite Already Used"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {status === "not_found" &&
                "This invite link is invalid or has been removed."}
              {status === "expired" &&
                "This invite has expired. Please ask your administrator to send a new one."}
              {status === "used" &&
                "This invite has already been used. If this was you, try signing in."}
            </p>
            <Button variant="outline" asChild>
              <Link href="/auth/login">Go to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success fallback (auto sign-in failed) ────────────────────────
  if (status === "success") {
    const dashPath = invite ? getDashboardPath(invite.role as Role) : "/auth/login";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold">Account Ready</h2>
            <p className="text-sm text-muted-foreground">
              Your account has been created. Sign in to access your dashboard.
            </p>
            <Button asChild className="w-full">
              <Link href={`/auth/login?redirect=${encodeURIComponent(dashPath)}`}>
                Sign In to Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <Logo size={36} />
          </div>
          <CardTitle className="text-center">Join RideCheck</CardTitle>
          <div className="text-center space-y-2 mt-1">
            <p className="text-sm text-muted-foreground">You have been invited as</p>
            <Badge className="no-default-hover-elevate no-default-active-elevate">
              {getRoleLabel(invite!.role as Role)}
            </Badge>
            <p className="text-xs text-muted-foreground">
              for <strong>{invite!.email}</strong>
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="mb-2 block">Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Your full name"
                data-testid="input-invite-fullname"
              />
            </div>
            <div>
              <Label className="mb-2 block">Phone (optional)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                data-testid="input-invite-phone"
              />
            </div>
            <div>
              <Label className="mb-2 block">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  data-testid="input-invite-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Confirm Password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Confirm your password"
                data-testid="input-invite-confirm-password"
              />
            </div>

            {(errorMsg || status === "error") && (
              <p className="text-sm text-destructive" data-testid="text-invite-error">
                {errorMsg}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              data-testid="button-accept-invite"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {(status as string) === "signing_in" ? "Signing in…" : "Creating Account…"}
                </span>
              ) : (
                "Create Account & Sign In"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
