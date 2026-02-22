// app/(public)/page.tsx
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RideCheck — Do Not Buy Blind. RideCheck It.",
  description:
    "You inspect a house before you buy. Make used-car inspections a habit. Professional, documented pre-purchase inspections and buyer-ready reports.",
};

export default function PublicHomePage() {
  return (
    <main className="bg-white text-gray-900">
      {/* HERO */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-white" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2 md:py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Buyer-first. Professional. Neutral.
            </div>

            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
              Do Not Buy Blind. <span className="text-blue-700">RideCheck It.</span>
            </h1>

            <p className="mt-4 text-lg leading-relaxed text-gray-700">
              You inspect a house before you buy. Used cars deserve the same due diligence.
              RideCheck sends a qualified inspector and delivers a buyer-ready report so you can
              make an informed decision — without guessing.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/book"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Book an Inspection →
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-gray-50"
              >
                How it Works
              </a>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="Starting at" value="$119" sub="Buyer-friendly due diligence" />
              <Stat label="On-site time" value="~45 min" sub="Documented inspection" />
              <Stat label="Report" value="Buyer-ready" sub="Photos + findings" />
            </div>

            <p className="mt-6 text-sm text-gray-600">
              We’re not here to demonize sellers. Some cars are great. Our job is to make sure you
              don’t buy blind.
            </p>
          </div>

          {/* IMAGE */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-gray-100">
              <Image
                src="/images/hero-inspection.jpg"
                alt="Professional used car inspection"
                fill
                className="object-cover"
                priority
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">What you get</div>
                <ul className="mt-2 space-y-2 text-sm text-gray-700">
                  <li>✓ Photos + documented findings</li>
                  <li>✓ Mechanical + condition overview</li>
                  <li>✓ Clear “next steps” recommendations</li>
                </ul>
              </div>

              <div className="rounded-xl border bg-blue-50 p-4">
                <div className="text-xs font-semibold text-blue-800">Why it matters</div>
                <p className="mt-2 text-sm text-gray-700">
                  One inspection can save you thousands — or confirm you found a clean car worth buying.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-extrabold md:text-3xl">How RideCheck works</h2>
        <p className="mt-3 max-w-3xl text-gray-700">
          Simple process. Professional output. You stay in control.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card
            step="01"
            title="Paste the listing link"
            desc="Share the car listing (or VIN + location). We handle the rest."
          />
          <Card
            step="02"
            title="Choose how to schedule"
            desc="Self-Arranged (you already have a time) or Concierge (we coordinate)."
          />
          <Card
            step="03"
            title="Get your report"
            desc="You receive a buyer-ready report with photos and findings to make a smart decision."
          />
        </div>
      </section>

      {/* BOOKING TYPES (DON'T BREAK YOUR FLOW — JUST EXPLAIN IT) */}
      <section className="border-t bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-extrabold md:text-3xl">Two ways to book</h2>
          <p className="mt-3 max-w-3xl text-gray-700">
            RideCheck supports your existing booking options. Pick what fits your situation.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-gray-500">Self-Arranged</div>
              <div className="mt-2 text-lg font-extrabold">You already have an appointment</div>
              <p className="mt-2 text-sm text-gray-700">
                If you have a time confirmed with the seller, choose Self-Arranged and we’ll show up and inspect.
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-gray-500">Concierge</div>
              <div className="mt-2 text-lg font-extrabold">We coordinate with the seller</div>
              <p className="mt-2 text-sm text-gray-700">
                If you don’t want to chase the seller, choose Concierge and we handle scheduling and confirmation.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border bg-white p-6 md:flex-row md:items-center">
            <div>
              <div className="text-lg font-bold">Ready to inspect before you buy?</div>
              <p className="mt-1 text-gray-700">
                Make it a habit. Don’t guess. Don’t buy blind.
              </p>
            </div>
            <a
              href="/book"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Book RideCheck →
            </a>
          </div>
        </div>
      </section>

      {/* TRUST / PROFESSIONALISM */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-extrabold md:text-3xl">Professional. Neutral. Buyer-first.</h2>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Callout
            title="Structured inspection"
            desc="Standardized checkpoints and documented findings — like a home inspection."
          />
          <Callout
            title="Clear reporting"
            desc="Photos + plain-English findings + what to do next."
          />
          <Callout
            title="Buyer-friendly pricing"
            desc="Due diligence that stays within reach — because smart buying should be normal."
          />
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white md:p-12">
            <h2 className="text-2xl font-extrabold md:text-4xl">Do Not Buy Blind. RideCheck It.</h2>
            <p className="mt-3 max-w-2xl text-white/90">
              You don’t need fear-based marketing. You need a habit: inspect before you buy.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/book"
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50"
              >
                Book My Inspection →
              </a>
              <a
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                View Pricing →
              </a>
            </div>

            <p className="mt-5 text-xs text-white/70">
              RideCheck provides a professional inspection and documented findings to support your decision.
              It is not a warranty or guarantee of future condition.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

/* -------- components ---------- */

function Stat(props: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-500">{props.label}</div>
      <div className="mt-1 text-xl font-extrabold">{props.value}</div>
      <div className="mt-1 text-xs text-gray-600">{props.sub}</div>
    </div>
  );
}

function Card(props: { step: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="text-xs font-bold text-blue-700">{props.step}</div>
      <div className="mt-2 text-lg font-extrabold">{props.title}</div>
      <p className="mt-2 text-sm text-gray-700">{props.desc}</p>
    </div>
  );
}

function Callout(props: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="text-base font-bold">{props.title}</div>
      <p className="mt-2 text-sm text-gray-700">{props.desc}</p>
    </div>
  );
}