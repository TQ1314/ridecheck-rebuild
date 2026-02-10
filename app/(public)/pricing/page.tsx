"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight } from "lucide-react";
import { PACKAGE_INFO, PRICING, formatCurrency } from "@/lib/utils/pricing";
import type { PackageType } from "@/lib/utils/pricing";

const PACKAGES: PackageType[] = ["standard", "premium", "comprehensive"];

export default function PricingPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold mb-3">Simple, Transparent Pricing</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Choose the inspection package that fits your needs. Self-arranged
            appointments save you money.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PACKAGES.map((pkg) => {
            const info = PACKAGE_INFO[pkg];
            const prices = PRICING[pkg];
            const isPremium = pkg === "premium";
            return (
              <Card
                key={pkg}
                className={`relative ${isPremium ? "border-primary" : ""}`}
              >
                {isPremium && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="no-default-hover-elevate no-default-active-elevate">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2 pt-8">
                  <CardTitle className="text-xl">{info.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{info.tagline}</p>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center mb-6">
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-4xl font-bold">
                        {formatCurrency(prices.self)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        self-arranged
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      or {formatCurrency(prices.full)} with concierge
                    </p>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {info.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={`/book?package=${pkg}`}>
                    <Button
                      className="w-full"
                      variant={isPremium ? "default" : "outline"}
                      data-testid={`button-select-${pkg}`}
                    >
                      Select {info.name}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-lg font-semibold mb-2">
            What&apos;s the difference between Self-Arranged and Concierge?
          </h3>
          <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Self-Arranged</h4>
                <p className="text-sm text-muted-foreground">
                  You schedule the appointment with the seller. We show up,
                  inspect, and deliver your report. You save a few dollars.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Concierge</h4>
                <p className="text-sm text-muted-foreground">
                  We handle everything — contact the seller, schedule the
                  appointment, and coordinate the inspection. Sit back and
                  wait for your report.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
