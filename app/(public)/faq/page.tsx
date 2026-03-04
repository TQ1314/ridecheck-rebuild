import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ - RideCheck",
  description:
    "Frequently asked questions about RideCheck pre-purchase vehicle inspection service.",
};

export default function FaqPage() {
  return (
    <main className="bg-white text-gray-900">
      <section className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-3xl font-extrabold md:text-4xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-gray-600">
          Everything you need to know about booking a RideCheck inspection.
        </p>

        <div className="mt-10 space-y-6">
          <FaqItem
            q="What is RideCheck?"
            a="RideCheck is an independent, on-site vehicle inspection service. We send a trained inspector to the car you are interested in, check it in person, and deliver a buyer-ready report with photos and findings so you know what you are buying before you pay."
          />
          <FaqItem
            q="How long does the inspection take?"
            a="The on-site inspection typically takes 45 to 60 minutes. Your report is delivered within 4 to 6 hours after the inspection is completed."
          />
          <FaqItem
            q="Do I need to be present?"
            a="No. The inspector goes to the vehicle, completes the inspection, and sends you the report. You do not need to be there."
          />
          <FaqItem
            q="What if I already have an appointment with the seller?"
            a="Choose Self-Arranged when booking. Enter your confirmed date and time, and we will send an inspector to meet the seller at the location."
          />
          <FaqItem
            q="What if I have not contacted the seller yet?"
            a="Choose Concierge. We will reach out to the seller, coordinate a time, and handle the scheduling for you."
          />
          <FaqItem
            q="What areas do you serve?"
            a="We are currently operating in Lake County, IL during our pilot phase. More areas are coming soon."
          />
          <FaqItem
            q="What if the car turns out to be in great condition?"
            a="Great. Then your report confirms it, and you can buy with confidence. That peace of mind is exactly the point."
          />
          <FaqItem
            q="How much does it cost?"
            a="Flat pricing based on vehicle type: Standard $139, Plus $169, Premium $189, Exotic $299. No hidden fees."
          />
          <FaqItem
            q="Is RideCheck a warranty or guarantee?"
            a="No. RideCheck provides an independent inspection and documented findings to support your purchase decision. It is not a warranty or guarantee of future mechanical performance."
          />
          <FaqItem
            q="Can I use RideCheck for cars listed on Facebook Marketplace or Craigslist?"
            a="Absolutely. That is one of the most common reasons buyers use RideCheck, to get professional eyes on a vehicle before committing to a private sale."
          />
        </div>

        <div className="mt-12 rounded-2xl bg-emerald-50 p-6 text-center">
          <p className="text-sm text-gray-700">Still have questions?</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold hover:bg-white"
            >
              Contact Us
            </Link>
            <Link
              href="/book"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Book an Inspection
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-b pb-6">
      <h2 className="text-base font-bold text-gray-900">{q}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{a}</p>
    </div>
  );
}
