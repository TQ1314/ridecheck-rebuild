"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Eye, EyeOff, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RideCheckerSignupPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [experience, setExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ridechecker/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          phone: phone || null,
          serviceArea: serviceArea || null,
          experience: experience || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      toast({
        title: "Application submitted",
        description: "Your RideChecker account has been created. Sign in to access your dashboard.",
      });
      router.push("/auth/login");
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err.message || "Something went wrong",
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
            data-testid="link-home"
          >
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">RideCheck</span>
          </Link>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Become a RideChecker</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Apply to join our network of vehicle assessment professionals
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
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
              <Label htmlFor="serviceArea">Service Area</Label>
              <Input
                id="serviceArea"
                placeholder="e.g. San Francisco Bay Area"
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                data-testid="input-service-area"
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
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
              data-testid="button-register"
            >
              {loading ? "Submitting..." : "Apply as RideChecker"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-primary hover:underline font-medium"
              data-testid="link-login"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
