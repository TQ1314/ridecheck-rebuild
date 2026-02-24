"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Car } from "lucide-react";
import { PACKAGE_INFO, PRICING, formatCurrency } from "@/lib/utils/pricing";
import type { PackageType } from "@/lib/utils/pricing";

const PACKAGES: PackageType[] = ["standard", "plus", "premium", "exotic"];

export default function PricingPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold mb-3">Simple, Transparent Pricing</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Your vehicle determines the right package — no guessing, no upsells.
            Just tell us what you&apos;re looking at and we&apos;ll match the right assessment.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {PACKAGES.map((pkg) => {
            const info = PACKAGE_INFO[pkg];
            const prices = PRICING[pkg];
            const isHighlighted = pkg === "plus";
            return (
              <Card
                key={pkg}
                className={`relative ${isHighlighted ? "border-primary" : ""}`}
              >
                {isHighlighted && (
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
                        {pkg === "exotic"
                          ? `${formatCurrency(prices.full)}+`
                          : formatCurrency(prices.full)}
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {info.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/book">
                    <Button
                      className="w-full"
                      variant={isHighlighted ? "default" : "outline"}
                      data-testid={`button-select-${pkg}`}
                    >
                      Book Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 max-w-2xl mx-auto">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Car className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">How is my package determined?</h4>
                  <p className="text-sm text-muted-foreground">
                    Your vehicle determines the assessment level. Luxury brands get Premium,
                    EVs and heavy-duty trucks get Plus, and standard vehicles get Standard.
                    Exotic and high-value vehicles ($60k+) get the Exotic package.
                    Just enter your vehicle details when booking — we&apos;ll match the right package automatically.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-lg font-semibold mb-2">
            What&apos;s the difference between Concierge and Self-Arranged?
          </h3>
          <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Buyer-Arranged</h4>
                <p className="text-sm text-muted-foreground">
                  You schedule the appointment with the seller. We show up,
                  inspect, and deliver your report.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Concierge</h4>
                <p className="text-sm text-muted-foreground">
                  We handle everything — contact the seller, schedule the
                  appointment, and coordinate the assessment. Sit back and
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
