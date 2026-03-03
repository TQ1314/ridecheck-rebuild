"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/hooks/use-toast";
import { getDashboardPath, type Role } from "@/lib/utils/roles";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const error = searchParams.get("error");
  const redirect = searchParams.get("redirect");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (redirect) {
        router.push(redirect);
      } else if (data.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .maybeSingle();

        const role = (profile?.role || "customer") as Role;
        router.push(getDashboardPath(role));
      } else {
        router.push("/orders");
      }
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/5 via-background to-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 mb-4"
          >
            <Logo size={36} />
            <span className="text-2xl font-bold">RideCheck</span>
          </Link>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to your account
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm mb-4" data-testid="text-login-error">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error === "deactivated"
                ? "Your account has been deactivated. Contact support for help."
                : error === "profile_missing"
                ? "Your account profile was not found. Please contact support."
                : error === "profile_read_failed"
                ? "Unable to verify your account. Please try again or contact support."
                : "An error occurred. Please try again."}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-primary hover:underline"
                  data-testid="link-forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="button-login"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="text-primary hover:underline font-medium"
              data-testid="link-register"
            >
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
