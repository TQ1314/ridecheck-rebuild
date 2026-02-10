"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  ClipboardList,
  CreditCard,
  Phone,
  Calendar,
  Wrench,
  FileText,
  CheckCircle2,
} from "lucide-react";

const SELF_STEPS = [
  {
    icon: ClipboardList,
    title: "1. Submit Your Order",
    desc: "Fill out the booking form with vehicle details and your preferred date.",
  },
  {
    icon: CreditCard,
    title: "2. Pay Online",
    desc: "Complete payment securely via Stripe. Your inspector is confirmed immediately.",
  },
  {
    icon: Wrench,
    title: "3. Inspection Day",
    desc: "Our certified tech arrives at the vehicle location for a thorough inspection.",
  },
  {
    icon: FileText,
    title: "4. Get Your Report",
    desc: "Receive a detailed digital report with photos and a clear buy/don't-buy recommendation.",
  },
];

const CONCIERGE_STEPS = [
  {
    icon: ClipboardList,
    title: "1. Submit Your Order",
    desc: "Fill out the booking form with the vehicle and seller details.",
  },
  {
    icon: Phone,
    title: "2. We Contact the Seller",
    desc: "Our team reaches out to the seller to coordinate and confirm an appointment.",
  },
  {
    icon: CreditCard,
    title: "3. Pay When Confirmed",
    desc: "Once the seller confirms, we send you a payment link. No charge until confirmed.",
  },
  {
    icon: Calendar,
    title: "4. Inspection Scheduled",
    desc: "We handle all logistics and schedule the inspection at the confirmed time.",
  },
  {
    icon: Wrench,
    title: "5. Inspection Day",
    desc: "Our certified tech performs the multi-point inspection at the vehicle location.",
  },
  {
    icon: FileText,
    title: "6. Get Your Report",
    desc: "Receive a detailed digital report delivered straight to your inbox.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold mb-3">How RideCheck Works</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you arrange the appointment yourself or let us handle
            everything, getting a professional inspection is easy.
          </p>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            Self-Arranged
          </h2>
          <p className="text-muted-foreground mb-6">
            Already have an appointment with the seller? Save money and book
            directly.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SELF_STEPS.map((step) => (
              <Card key={step.title}>
                <CardContent className="flex items-start gap-4 pt-5 pb-5">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            Concierge Service
          </h2>
          <p className="text-muted-foreground mb-6">
            Let us handle the coordination. We contact the seller, schedule
            the appointment, and manage everything.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONCIERGE_STEPS.map((step) => (
              <Card key={step.title}>
                <CardContent className="flex items-start gap-4 pt-5 pb-5">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="text-center py-10 rounded-lg bg-muted/50">
          <h2 className="text-2xl font-bold mb-3">Ready to get started?</h2>
          <p className="text-muted-foreground mb-6">
            Book your inspection in minutes. It could save you thousands.
          </p>
          <Link href="/book">
            <Button size="lg" data-testid="button-book-cta">
              Book an Inspection
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
