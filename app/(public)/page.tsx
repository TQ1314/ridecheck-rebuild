"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Search,
  FileText,
  CheckCircle2,
  ArrowRight,
  Star,
  Car,
  Clock,
  Wrench,
} from "lucide-react";

const STEPS = [
  {
    icon: Search,
    title: "Book Online",
    description:
      "Select your package, enter vehicle details, and choose your preferred inspection date.",
  },
  {
    icon: Wrench,
    title: "We Inspect",
    description:
      "Our certified technician performs a thorough multi-point inspection at the vehicle location.",
  },
  {
    icon: FileText,
    title: "Get Your Report",
    description:
      "Receive a detailed digital report with photos, findings, and a clear buy/don't-buy recommendation.",
  },
];

const STATS = [
  { value: "10,000+", label: "Inspections Completed" },
  { value: "98%", label: "Customer Satisfaction" },
  { value: "150+", label: "Inspection Points" },
  { value: "24hr", label: "Report Turnaround" },
];

export default function LandingPage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-6">
              <Shield className="h-4 w-4" />
              Trusted by thousands of car buyers
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              Buy with{" "}
              <span className="text-primary">confidence.</span>
              <br />
              Not with worry.
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl">
              RideCheck sends certified mechanics to inspect any used car before you buy.
              Get a detailed report with photos, diagnostics, and a clear recommendation.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/book">
                <Button size="lg" data-testid="button-hero-book">
                  Book an Inspection
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button variant="outline" size="lg" data-testid="button-hero-learn">
                  How It Works
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-48 -left-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">How RideCheck Works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Three simple steps to peace of mind before your next car purchase.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <Card key={step.title} className="relative">
                <CardContent className="pt-8 pb-6 px-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-5">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="absolute top-4 right-4 text-xs font-bold text-muted-foreground/50">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Why Choose RideCheck?</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: CheckCircle2,
                title: "Certified Technicians",
                desc: "Every inspector is ASE-certified with years of experience.",
              },
              {
                icon: Car,
                title: "On-Location Service",
                desc: "We come to the car — dealership, private seller, or anywhere.",
              },
              {
                icon: Clock,
                title: "Fast Turnaround",
                desc: "Get your detailed report in as little as 6 hours.",
              },
              {
                icon: FileText,
                title: "Detailed Reports",
                desc: "Photo-documented findings with clear recommendations.",
              },
              {
                icon: Shield,
                title: "Unbiased Opinion",
                desc: "We have no stake in the sale — just honest assessments.",
              },
              {
                icon: Star,
                title: "Satisfaction Guaranteed",
                desc: "If you're not happy, we'll make it right.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardContent className="pt-6 pb-5 px-6">
                  <item.icon className="h-8 w-8 text-primary mb-4" />
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to buy with confidence?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Don't let a bad deal cost you thousands. Book a professional
            inspection today and know exactly what you're getting.
          </p>
          <Link href="/book">
            <Button size="lg" data-testid="button-cta-book">
              Book Your Inspection
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
