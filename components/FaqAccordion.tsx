"use client";

import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What is RideCheck?",
    a: `RideCheck is an independent, on-site vehicle inspection service designed for used-car buyers.
We send a trained RideChecker to inspect the vehicle where it sits and provide detailed photos, videos, and written observations so you can make a confident decision.`,
  },
  {
    q: "How does RideCheck work?",
    a: `1) Paste the car listing link.
2) Tell us how to reach you.
3) Pay securely through Stripe (we text/email you a secure payment link).
4) We contact the seller, schedule the visit, complete the inspection, and send your report within 24–48 hours.
You never have to coordinate with the seller — we handle it.`,
  },
  {
    q: "What does a RideCheck inspection include?",
    a: `Every inspection includes seller coordination, travel to the vehicle, exterior/interior checks, engine bay visual inspection, fluid visual check, tire/brake visual condition, OBD-II scan (when possible), road test (only if the seller allows), 40–100+ photos/videos, and written observations.
This is a non-invasive visual inspection — not a mechanical teardown.`,
  },
  {
    q: "How long does the inspection take?",
    a: `Most inspections are completed and delivered within 24–48 hours, depending on seller availability, location, weather, and access.`,
  },
  {
    q: "Do you contact the seller for me?",
    a: `Yes. After payment, our team contacts the seller directly and coordinates the inspection. You don’t need to chase anyone.`,
  },
  {
    q: "When will I receive my report?",
    a: `Once the inspection is completed, your report is delivered digitally via text and email—typically the same day the inspection is completed.`,
  },
  {
    q: "How much does RideCheck cost?",
    a: `Pricing depends on the vehicle type. Standard vehicles start at $119. Certain vehicle types (European, EV, heavy-duty, luxury/exotic) may require higher-tier pricing. You’ll see the final price before payment—no hidden fees.`,
  },
  {
    q: "Do you inspect salvage or rebuilt vehicles?",
    a: `Yes—if the seller allows access. Note: we can’t verify structural repairs beyond what’s visible without disassembly.`,
  },
  {
    q: "How many photos do I get?",
    a: `Most inspections include 40–100+ high-resolution photos and supporting video clips.`,
  },
  {
    q: "Do you offer same-day inspections?",
    a: `In many cases, yes—depending on RideChecker availability, seller responsiveness, and location.`,
  },
  {
    q: "Do you guarantee the vehicle?",
    a: `No. RideCheck provides a professional visual inspection based on observable conditions at the time of inspection. We do not guarantee future performance, mechanical reliability, or seller honesty.`,
  },
  {
    q: "How do payments work?",
    a: `Payments are processed securely through Stripe. We do not store your card information. Inspections are scheduled only after payment is completed.`,
  },
  {
    q: "Why should I use RideCheck instead of going myself?",
    a: `Most buyers use RideCheck because the car is far away, the seller is unreliable, they don’t know what to look for, or they want professional documentation before committing. RideCheck protects your time, money, and peace of mind.`,
  },
  {
    q: "Still have questions?",
    a: `We’re here to help. Contact Support via Live Chat, WhatsApp, phone, or email.`,
  },
];

export default function FaqAccordion() {
  return (
    <section className="w-full max-w-3xl mx-auto px-4 py-10">
      <h2 className="text-3xl font-semibold tracking-tight">
        RideCheck FAQ — Honest Answers for Real Used-Car Buyers
      </h2>
      <p className="mt-3 text-muted-foreground">
        Click a question to view the answer. Simple, honest, and clear.
      </p>

      <div className="mt-8">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((item, idx) => (
            <AccordionItem key={idx} value={`item-${idx}`}>
              <AccordionTrigger className="text-left">
                {item.q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="whitespace-pre-line leading-relaxed">
                  {item.a}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}