"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/* ─── FAQ Data ─────────────────────────────────────────────── */
const FAQS = [
  {
    q: "Does the buyer take my car for a test drive?",
    a: "No. RideCheck inspections are visual and OBD-scan based only. The RideChecker observes the vehicle at the agreed location — there is no test drive and no driving of your vehicle.",
  },
  {
    q: "Does this cost me anything?",
    a: "Nothing. The buyer pays for the inspection. You simply agree to have the vehicle available at an agreed time and location. There are no seller fees of any kind.",
  },
  {
    q: "How long does it take?",
    a: "Most inspections take 45–90 minutes. Our RideCheckers are punctual and professional. You don't need to be present for the entire process — just make the vehicle accessible.",
  },
  {
    q: "What if the buyer walks away after the inspection?",
    a: "That's their right. But buyers who order a RideCheck are genuinely serious about purchasing. In our experience, inspection requests accelerate decisions rather than kill deals. And if they walk, you've lost nothing.",
  },
  {
    q: "Can I use the report to market my vehicle?",
    a: "Yes. If the buyer shares the report with you (their discretion), you can reference its findings to reassure future buyers. Some sellers use this as a \"pre-inspected\" selling point.",
  },
];

/* ─── Benefits ─────────────────────────────────────────────── */
const BENEFITS = [
  {
    icon: Clock,
    title: "Faster Closings",
    body: "Buyers with a report in hand make decisions faster. No second-guessing, no stalling for \"more time to think.\"",
  },
  {
    icon: TrendingUp,
    title: "Fewer Lowball Offers",
    body: "An independent third-party report validates your asking price. Serious buyers negotiate from facts, not fear.",
  },
  {
    icon: Users,
    title: "Only Serious Buyers",
    body: "Someone willing to pay for an inspection isn't going to ghost you. These are committed buyers.",
  },
  {
    icon: FileText,
    title: "Reusable Credibility",
    body: "If the deal falls through, the inspection was non-invasive and your vehicle is unchanged — nothing lost.",
  },
];

/* ─── Process Steps ─────────────────────────────────────────── */
const STEPS = [
  {
    num: "01",
    title: "Buyer contacts you",
    body: "A buyer wants to see your vehicle. They're serious enough to schedule a RideCheck.",
  },
  {
    num: "02",
    title: "You agree on a time & place",
    body: "Our team coordinates with both parties. You choose where — your driveway, a parking lot, anywhere convenient.",
  },
  {
    num: "03",
    title: "RideChecker arrives",
    body: "A vetted RideCheck inspector performs a visual and OBD-scan assessment. No driving, no disassembly.",
  },
  {
    num: "04",
    title: "Deal moves forward",
    body: "The buyer gets their report. Confident buyers close faster. You get your asking price — or a fair negotiation.",
  },
];

/* ─── FAQ Accordion ─────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        className="flex w-full items-center justify-between py-4 text-left text-sm font-medium text-gray-900 hover:text-emerald-700 transition-colors"
        onClick={() => setOpen((o) => !o)}
        data-testid={`faq-toggle-${q.slice(0, 20).replace(/\s/g, "-").toLowerCase()}`}
      >
        {q}
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>
      {open && (
        <p className="pb-4 text-sm text-gray-600 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

/* ─── Checklist Form ────────────────────────────────────────── */
function ChecklistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center" data-testid="checklist-success">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <p className="text-lg font-semibold text-gray-900">You're on the list!</p>
        <p className="text-sm text-gray-600 max-w-xs">
          We'll send the Seller Closing Checklist (Illinois Edition) to <strong>{email}</strong> shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto" data-testid="form-checklist">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="seller-name">
          Your name
        </label>
        <input
          id="seller-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          data-testid="input-seller-name"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="seller-email">
          Email address
        </label>
        <input
          id="seller-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          data-testid="input-seller-email"
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={loading}
        data-testid="button-checklist-submit"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Sending…
          </span>
        ) : (
          "Send Me the Checklist"
        )}
      </Button>
      <p className="text-center text-xs text-gray-500">No spam. Unsubscribe anytime.</p>
    </form>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function SellerPage() {
  return (
    <div className="bg-white text-gray-900">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-4 py-20 text-white text-center">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-700/50 px-4 py-1.5 text-xs font-medium text-emerald-200 mb-6 border border-emerald-600/40">
            <Star className="h-3 w-3 fill-emerald-300 text-emerald-300" />
            For Private Sellers in Lake County, IL
          </div>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6"
            data-testid="text-seller-hero-headline"
          >
            A buyer requested a RideCheck?
            <br />
            <span className="text-emerald-300">That's how serious deals get DONE.</span>
          </h1>
          <p className="text-lg text-emerald-100 max-w-2xl mx-auto mb-8 leading-relaxed">
            RideCheck is a third-party vehicle inspection service paid for by the buyer —
            not you. It helps serious buyers build confidence so they can close the deal
            without the back-and-forth.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#checklist">
              <Button
                size="lg"
                className="bg-white text-emerald-900 hover:bg-emerald-50 font-semibold"
                data-testid="button-hero-checklist"
              >
                Get the Seller Checklist
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </a>
            <a href="#how-it-works">
              <Button
                size="lg"
                variant="outline"
                className="border-emerald-400 text-white hover:bg-emerald-800 bg-transparent"
                data-testid="button-hero-how-it-works"
              >
                See How It Works
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Reassurance Banner ───────────────────────────────── */}
      <section className="border-b border-gray-100 bg-emerald-50 px-4 py-6">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-center gap-6 text-center sm:text-left text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <span><strong>No cost to you</strong> — buyer pays</span>
          </div>
          <div className="hidden sm:block text-emerald-300">|</div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span><strong>Visual only</strong> — no driving, no disassembly</span>
          </div>
          <div className="hidden sm:block text-emerald-300">|</div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-600 shrink-0" />
            <span><strong>45–90 minutes</strong> — quick and professional</span>
          </div>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────── */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-benefits-heading">
              Why Sellers Love RideCheck
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm">
              A third-party inspection doesn't just help buyers — it removes the biggest friction points
              slowing down your sale.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {BENEFITS.map((b) => (
              <Card key={b.title} className="border border-gray-100 shadow-sm">
                <CardContent className="p-6 flex gap-4">
                  <div className="shrink-0 mt-0.5 h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <b.icon className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{b.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{b.body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section id="how-it-works" className="bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-how-it-works-heading">
              What Happens From Your Side
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm">
              Four simple steps — most of which don't require anything from you at all.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {STEPS.map((s) => (
              <div key={s.num} className="flex gap-4" data-testid={`step-${s.num}`}>
                <div className="shrink-0 text-3xl font-black text-emerald-200 leading-none w-10">{s.num}</div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pre-Listing CTA ──────────────────────────────────── */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <Card className="border-2 border-emerald-200 bg-emerald-50 shadow-none">
            <CardContent className="p-8 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 mb-4 border border-emerald-200">
                <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" />
                RideCheck Verified — Coming Soon
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                List Your Car as Pre-Inspected
              </h2>
              <p className="text-gray-600 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
                Sellers who proactively order a RideCheck before listing can display a
                <strong> "RideCheck Verified"</strong> badge on their listing. It signals
                transparency to every buyer who sees it — before they even reach out.
                Less haggling. More offers. Faster close.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/book">
                  <Button className="font-semibold" data-testid="button-pre-listing-book">
                    Request an Inspection
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <a href="#checklist">
                  <Button variant="outline" data-testid="button-pre-listing-checklist">
                    Get the Seller Checklist First
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Checklist Email Capture ──────────────────────────── */}
      <section id="checklist" className="bg-gray-900 px-4 py-16 text-white">
        <div className="mx-auto max-w-lg text-center">
          <FileText className="h-8 w-8 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2" data-testid="text-checklist-heading">
            Seller Closing Checklist
            <span className="block text-emerald-400 text-lg font-medium mt-1">Illinois Edition</span>
          </h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            A practical pre-sale checklist for Illinois private sellers — title requirements,
            odometer disclosure, bill of sale, and everything you need to close clean.
            Free. No commitment.
          </p>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <ChecklistForm />
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2" data-testid="text-faq-heading">
              Seller Questions, Answered
            </h2>
            <p className="text-gray-500 text-sm">
              Everything you need to know before a RideCheck happens on your vehicle.
            </p>
          </div>
          <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white px-6 shadow-sm">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────── */}
      <section className="bg-emerald-700 px-4 py-12 text-white text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="text-2xl font-bold mb-3">Ready to move forward?</h2>
          <p className="text-emerald-100 text-sm mb-6">
            Whether a buyer asked you to cooperate or you want to list pre-inspected —
            we're here to make it simple.
          </p>
          <Link href="/book">
            <Button
              size="lg"
              className="bg-white text-emerald-900 hover:bg-emerald-50 font-semibold"
              data-testid="button-bottom-book"
            >
              Book an Inspection
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
