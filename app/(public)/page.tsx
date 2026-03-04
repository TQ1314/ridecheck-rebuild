// app/(public)/page.tsx
import Link from "next/link";
import { HeroSlideshow } from "@/components/ui/hero-slideshow";
import type { Metadata } from "next";
import {
  Shield,
  Search,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Car,
  MapPin,
  Eye,
  Phone,
  ClipboardCheck,
  XCircle,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "RideCheck — Do Not Buy Blind. RideCheck It.",
  description:
    "Buying a used car? RideCheck sends a qualified inspector to the vehicle, checks it in person, and delivers a buyer-ready report — so you know what you're buying before you pay.",
};

export default function PublicHomePage() {
  return (
    <main className="bg-white text-gray-900">

      {/* ========== HERO ========== */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 to-white" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2 md:py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Independent Vehicle Inspection Service
            </div>

            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
              Do Not Buy Blind. <span className="text-emerald-700">RideCheck It.</span>
            </h1>

            <p className="mt-4 text-lg font-medium leading-relaxed text-gray-800">
              Buying a used car online? We send a qualified inspector to the vehicle,
              check it in person, and deliver a detailed report — so you know exactly
              what you're buying before you pay.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                On-site inspection by a trained RideChecker
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Photos, findings, and condition notes
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Buyer-ready report delivered to your inbox
              </li>
            </ul>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/book"
                data-testid="link-book-hero"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Book an Inspection →
              </a>
              <a
                href="#how-it-works"
                data-testid="link-how-it-works"
                className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-gray-50"
              >
                How it Works
              </a>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="Starting at" value="$139" sub="Flat, transparent pricing" />
              <Stat label="Report turnaround" value="4–6 hrs" sub="After on-site inspection" />
              <Stat label="Report" value="Buyer-ready" sub="Photos + findings" />
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <HeroSlideshow />

            <div className="mt-4 rounded-xl border bg-emerald-50 p-4">
              <div className="text-sm font-semibold text-emerald-800">How it works in 30 seconds</div>
              <ol className="mt-2 space-y-1.5 text-sm text-gray-700">
                <li><span className="font-bold text-emerald-700">1.</span> You book online with the vehicle details</li>
                <li><span className="font-bold text-emerald-700">2.</span> We send an inspector to the car</li>
                <li><span className="font-bold text-emerald-700">3.</span> You get a report with photos and findings</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ========== HOW RIDECHECK WORKS ========== */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-extrabold md:text-3xl">How RideCheck Works</h2>
        <p className="mt-3 max-w-3xl text-gray-700">
          Simple process. Professional output. You stay in control.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StepCard
            icon={<Car className="h-6 w-6 text-emerald-600" />}
            step="01"
            title="Share the vehicle"
            desc="Paste the listing link, or enter the year, make, model, and location."
          />
          <StepCard
            icon={<Phone className="h-6 w-6 text-emerald-600" />}
            step="02"
            title="Choose how to schedule"
            desc="Self-Arranged (you set the time) or Concierge (we coordinate with the seller)."
          />
          <StepCard
            icon={<ClipboardCheck className="h-6 w-6 text-emerald-600" />}
            step="03"
            title="Inspector visits the car"
            desc="A trained RideChecker goes on-site, inspects the vehicle, and documents findings."
          />
          <StepCard
            icon={<FileText className="h-6 w-6 text-emerald-600" />}
            step="04"
            title="Get your report"
            desc="Receive a buyer-ready report with photos, observations, and next-step guidance."
          />
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/what-we-check"
            data-testid="link-what-we-check"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
          >
            See everything we check <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ========== WHEN RIDECHECK IS USEFUL ========== */}
      <section className="border-t bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-extrabold md:text-3xl">RideCheck Is Most Helpful When</h2>
          <p className="mt-3 max-w-3xl text-gray-700">
            If any of these sound like you, RideCheck was built for your situation.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Scenario
              icon={<MapPin className="h-5 w-5 text-emerald-600" />}
              text="You're buying from Facebook Marketplace or Craigslist"
            />
            <Scenario
              icon={<Car className="h-5 w-5 text-emerald-600" />}
              text="The vehicle is in another city or too far to see first"
            />
            <Scenario
              icon={<Eye className="h-5 w-5 text-emerald-600" />}
              text="You want a second set of trained eyes on the car"
            />
            <Scenario
              icon={<Search className="h-5 w-5 text-emerald-600" />}
              text="You're not sure what to look for when inspecting a car"
            />
            <Scenario
              icon={<AlertTriangle className="h-5 w-5 text-emerald-600" />}
              text='The seller says the car is "perfect"'
            />
            <Scenario
              icon={<Shield className="h-5 w-5 text-emerald-600" />}
              text="You want peace of mind before sending money"
            />
          </div>
        </div>
      </section>

      {/* ========== RISKS ========== */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-extrabold md:text-3xl">Avoid Common Used Car Buying Risks</h2>
        <p className="mt-3 max-w-3xl text-gray-700">
          RideCheck helps buyers detect issues such as:
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <RiskItem text="Hidden engine problems" />
          <RiskItem text="Salvage or flood indicators" />
          <RiskItem text="Major wear or damage" />
          <RiskItem text="Seller misrepresentation" />
          <RiskItem text="Expensive repairs after purchase" />
          <RiskItem text="Undisclosed accident history signs" />
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section className="border-t bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-extrabold md:text-3xl">Simple, Transparent Pricing</h2>
          <p className="mt-3 max-w-3xl text-gray-700">
            Flat pricing based on vehicle type. No hidden fees.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <PriceCard tier="Standard" price="$139" desc="Most sedans, SUVs, trucks" />
            <PriceCard tier="Plus" price="$169" desc="Euro, EV, or heavy-duty vehicles" highlight />
            <PriceCard tier="Premium" price="$189" desc="Luxury or flagship models" />
            <PriceCard tier="Exotic" price="$299" desc="High-end exotic vehicles" />
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/pricing"
              data-testid="link-pricing-details"
              className="text-sm font-semibold text-emerald-700 hover:underline"
            >
              View full pricing details →
            </Link>
          </div>
        </div>
      </section>

      {/* ========== WHAT RIDECHECK IS / IS NOT ========== */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-extrabold md:text-3xl">What RideCheck Is — And What It Is Not</h2>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border bg-emerald-50 p-6">
            <div className="text-sm font-bold text-emerald-800">RideCheck IS</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                An independent, on-site vehicle inspection
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                A documented report with photos and findings
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                A tool to help you make an informed buying decision
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-6">
            <div className="text-sm font-bold text-gray-600">RideCheck is NOT</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                A vehicle warranty
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                A guarantee of future mechanical performance
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                A substitute for a full repair shop diagnostic
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-700 p-8 text-white md:p-12">
            <h2 className="text-2xl font-extrabold md:text-4xl">Do Not Buy Blind. RideCheck It.</h2>
            <p className="mt-3 max-w-2xl text-lg text-white/90">
              Before you send money for a car you found online, RideCheck it.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/book"
                data-testid="link-book-footer"
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50"
              >
                Book My Inspection →
              </a>
              <a
                href="/pricing"
                data-testid="link-pricing-footer"
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

          <p className="mt-6 text-center text-sm text-gray-500">
            Have questions?{" "}
            <Link href="/faq" className="font-semibold text-emerald-700 hover:underline">
              Read our FAQ
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

/* -------- local components ---------- */

function Stat(props: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-500">{props.label}</div>
      <div className="mt-1 text-xl font-extrabold">{props.value}</div>
      <div className="mt-1 text-xs text-gray-600">{props.sub}</div>
    </div>
  );
}

function StepCard(props: { icon: React.ReactNode; step: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        {props.icon}
        <span className="text-xs font-bold text-emerald-700">{props.step}</span>
      </div>
      <div className="mt-3 text-lg font-extrabold">{props.title}</div>
      <p className="mt-2 text-sm text-gray-700">{props.desc}</p>
    </div>
  );
}

function Scenario(props: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm">
      <div className="mt-0.5">{props.icon}</div>
      <span className="text-sm text-gray-700">{props.text}</span>
    </div>
  );
}

function RiskItem(props: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
      <span className="text-sm text-gray-800">{props.text}</span>
    </div>
  );
}

function PriceCard(props: { tier: string; price: string; desc: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        props.highlight ? "border-emerald-300 bg-emerald-50" : "bg-white"
      }`}
    >
      <div className="text-xs font-semibold text-gray-500">{props.tier}</div>
      <div className="mt-1 text-2xl font-extrabold">{props.price}</div>
      <p className="mt-1 text-sm text-gray-600">{props.desc}</p>
    </div>
  );
}
