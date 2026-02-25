"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  DollarSign,
  Clock,
  MapPin,
  Car,
  CheckCircle2,
  ArrowRight,
  Wrench,
  Users,
  TrendingUp,
} from "lucide-react";

const BENEFITS = [
  {
    icon: DollarSign,
    title: "Earn $50–$130 per job",
    description: "Competitive per-job pay based on vehicle type. Standard vehicles start at $50, with premium and exotic jobs paying up to $130.",
  },
  {
    icon: Clock,
    title: "Set your own schedule",
    description: "Choose which days you're available and how many jobs you take. No minimums, no mandatory shifts.",
  },
  {
    icon: MapPin,
    title: "Work in your area",
    description: "Jobs come to you based on your service area. No commuting to a central office — inspections happen at seller locations.",
  },
  {
    icon: TrendingUp,
    title: "Grow with us",
    description: "Top-rated RideCheckers get priority for premium and exotic vehicle jobs. Build your reputation and earn more.",
  },
  {
    icon: Users,
    title: "Referral rewards",
    description: "Earn $100 for every RideChecker you refer who completes 3 jobs in their first 30 days.",
  },
  {
    icon: Shield,
    title: "Backed by a real team",
    description: "Our operations team handles all customer communication, scheduling, and report delivery. You focus on what you do best — inspecting vehicles.",
  },
];

const REQUIREMENTS = [
  "Automotive knowledge — mechanical, electrical, or body work experience",
  "Reliable smartphone with camera for photo documentation",
  "OBD-II scanner (or willingness to acquire one)",
  "Valid driver's license and reliable transportation",
  "Professional demeanor and attention to detail",
  "Ability to complete a 30–45 minute structured assessment",
];

const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: "Apply",
    description: "Fill out a short application with your experience and service area. Our team reviews every application.",
  },
  {
    step: 2,
    title: "Get approved",
    description: "Once approved, you'll get access to the RideChecker dashboard where you can set your availability and view jobs.",
  },
  {
    step: 3,
    title: "Accept jobs",
    description: "Jobs appear based on your area and availability. Accept the ones that work for you and head to the inspection location.",
  },
  {
    step: 4,
    title: "Submit & get paid",
    description: "Complete the structured assessment, upload photos and findings, and get paid after our quality review.",
  },
];

export default function JoinPage() {
  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Wrench className="h-4 w-4" />
            Now accepting applications
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4" data-testid="heading-join">
            Become a RideChecker
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Join our network of vehicle assessment professionals. Earn competitive pay on your own schedule by helping car buyers make informed decisions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/ridechecker/signup">
              <Button size="lg" className="gap-2" data-testid="button-apply-hero">
                Apply Now
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Takes about 2 minutes
            </p>
          </div>
        </div>

        <div className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-10" data-testid="heading-benefits">
            Why become a RideChecker?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((benefit) => (
              <Card key={benefit.title} data-testid={`card-benefit-${benefit.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
                <CardContent className="pt-6 pb-5">
                  <benefit.icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-1.5">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-10" data-testid="heading-how-it-works">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <div key={item.step} className="text-center" data-testid={`step-${item.step}`}>
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-10" data-testid="heading-pay">
            What you can earn
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { tier: "Standard", pay: "$50", desc: "Common vehicles" },
              { tier: "Plus", pay: "$65", desc: "Euro, EV & HD trucks" },
              { tier: "Premium", pay: "$80", desc: "Luxury & flagship" },
              { tier: "Exotic", pay: "$130", desc: "Exotic & high-value" },
            ].map((item) => (
              <Card key={item.tier} data-testid={`card-pay-${item.tier.toLowerCase()}`}>
                <CardContent className="pt-5 pb-4 text-center">
                  <p className="text-2xl font-bold text-primary">{item.pay}</p>
                  <p className="font-semibold text-sm mt-1">{item.tier}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-10" data-testid="heading-requirements">
            What we look for
          </h2>
          <Card>
            <CardContent className="pt-6 pb-5">
              <ul className="space-y-3">
                {REQUIREMENTS.map((req) => (
                  <li key={req} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{req}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center bg-primary/5 rounded-xl p-8 sm:p-12 border border-primary/20">
          <Car className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3" data-testid="heading-cta">
            Ready to get started?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Apply today and start earning on your own schedule. Our team reviews applications within 48 hours.
          </p>
          <Link href="/ridechecker/signup">
            <Button size="lg" className="gap-2" data-testid="button-apply-bottom">
              Apply as RideChecker
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
