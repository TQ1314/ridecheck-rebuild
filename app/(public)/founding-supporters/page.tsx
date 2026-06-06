"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Users, DollarSign, ChevronDown, ChevronUp, Gift } from "lucide-react";
import { TIER_CONFIG } from "@/lib/founding/credit-code";

const TIERS = ["backer", "believer", "founding_partner"] as const;
type Tier = typeof TIERS[number];

interface Stats {
  total_raised_cents: number;
  supporter_count:    number;
  goal_cents:         number;
}

function formatDollars(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default function FoundingSupportersPage() {
  const router = useRouter();

  const [stats, setStats]             = useState<Stats | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier>("believer");
  const [showGift, setShowGift]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const [form, setForm] = useState({
    name:                  "",
    email:                 "",
    phone:                 "",
    gift_recipient_name:   "",
    gift_recipient_email:  "",
    gift_message:          "",
    list_on_partners_page: false,
    terms_accepted:        false,
  });

  useEffect(() => {
    fetch("/api/founding/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const pct = stats ? Math.min(100, Math.round((stats.total_raised_cents / stats.goal_cents) * 100)) : 0;

  const set = (k: string, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!form.terms_accepted) {
      setError("Please accept the terms to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/founding/create-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          tier:                  selectedTier,
          name:                  form.name.trim(),
          email:                 form.email.trim(),
          phone:                 form.phone.trim() || null,
          gift_recipient_name:   form.gift_recipient_name.trim()  || null,
          gift_recipient_email:  form.gift_recipient_email.trim() || null,
          gift_message:          form.gift_message.trim()         || null,
          list_on_partners_page: form.list_on_partners_page,
          terms_accepted:        form.terms_accepted,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(json.url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const tier = TIER_CONFIG[selectedTier];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="bg-emerald-950 text-white py-20 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="bg-emerald-700 text-white border-0 mb-4 text-xs tracking-widest uppercase">
            Founding Supporter Campaign
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight">
            Help Us Build a Safer Used-Car Market
          </h1>
          <p className="text-emerald-200 text-lg sm:text-xl max-w-2xl mx-auto mb-8">
            Every used-car buyer deserves the truth before they sign. We built RideCheck to give them that.
            Become a Founding Supporter — lock in your inspection credit at today's price and help us grow.
          </p>
          <p className="text-sm text-emerald-400 italic">— Harry, Founder of RideCheck</p>
        </div>
      </section>

      {/* ── Progress Bar ──────────────────────────────────────── */}
      <section className="border-b bg-emerald-50 dark:bg-emerald-950/30 py-8 px-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between mb-2 text-sm font-medium">
            <span className="text-emerald-700 dark:text-emerald-400">
              {stats ? formatDollars(stats.total_raised_cents) : "—"} raised
            </span>
            <span className="text-muted-foreground">
              Goal: {formatDollars(1_000_000)}
            </span>
          </div>
          <div className="h-3 bg-emerald-100 dark:bg-emerald-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-600" />
              {stats ? `${stats.supporter_count} supporter${stats.supporter_count !== 1 ? "s" : ""}` : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              {pct}% of goal
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-16 grid lg:grid-cols-2 gap-12 items-start">
        {/* ── Left: Tiers ───────────────────────────────────── */}
        <div>
          <h2 className="text-2xl font-bold mb-2">Choose Your Tier</h2>
          <p className="text-muted-foreground mb-8">
            Every tier includes at least one full RideCheck credit — valid for 24 months, usable on any vehicle.
          </p>

          <div className="space-y-4">
            {TIERS.map((t) => {
              const cfg      = TIER_CONFIG[t];
              const selected = selectedTier === t;
              return (
                <button
                  key={t}
                  type="button"
                  data-testid={`tier-${t}`}
                  onClick={() => setSelectedTier(t)}
                  className={`w-full text-left rounded-xl border-2 p-5 transition-all ${
                    selected
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 shadow-md"
                      : "border-border hover:border-emerald-300 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-base">{cfg.label}</span>
                        {cfg.popular && (
                          <Badge className="text-[10px] bg-emerald-600 text-white border-0 py-0 px-1.5">
                            Most Popular
                          </Badge>
                        )}
                      </div>
                      <ul className="mt-2 space-y-1">
                        {cfg.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-bold text-emerald-700">
                        ${cfg.amountCents / 100}
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 mt-2 ml-auto flex items-center justify-center ${
                          selected ? "border-emerald-600 bg-emerald-600" : "border-muted-foreground"
                        }`}
                      >
                        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Founder note */}
          <div className="mt-10 p-5 rounded-xl bg-muted border text-sm leading-relaxed">
            <p className="font-semibold mb-1">A note from Harry</p>
            <p className="text-muted-foreground">
              "I started RideCheck after watching too many buyers get burned on used cars.
              These credits aren't just a purchase — they're your vote for a more transparent market.
              Every Founding Supporter gets my personal thanks and early access to everything we build."
            </p>
          </div>
        </div>

        {/* ── Right: Form ───────────────────────────────────── */}
        <div>
          <Card className="border-2 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">
                Support at {tier.label} — ${tier.amountCents / 100}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {tier.creditsCount === 2
                  ? "Includes 2 Standard RideCheck Credits"
                  : "Includes 1 Standard RideCheck Credit"} · Valid 24 months
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="fs-name">
                    Your Full Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="fs-name"
                    data-testid="input-name"
                    type="text"
                    required
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="fs-email">
                    Email Address <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="fs-email"
                    data-testid="input-email"
                    type="email"
                    required
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Your credit code will be emailed here.</p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="fs-phone">
                    Phone <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    id="fs-phone"
                    data-testid="input-phone"
                    type="tel"
                    placeholder="(312) 555-0100"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* Founding Partner: list on page */}
                {selectedTier === "founding_partner" && (
                  <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 bg-emerald-50 dark:bg-emerald-950/30">
                    <input
                      type="checkbox"
                      data-testid="checkbox-list-partners"
                      checked={form.list_on_partners_page}
                      onChange={(e) => set("list_on_partners_page", e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-emerald-600"
                    />
                    <span className="text-sm">
                      List my name on the <span className="font-semibold">Founding Partners</span> public page
                      (first name + last initial only)
                    </span>
                  </label>
                )}

                {/* Gift toggle */}
                <button
                  type="button"
                  data-testid="button-gift-toggle"
                  onClick={() => setShowGift(!showGift)}
                  className="flex items-center gap-2 text-sm text-emerald-700 font-medium hover:underline"
                >
                  <Gift className="h-4 w-4" />
                  {showGift ? "Remove gift" : "Buying this as a gift?"}
                  {showGift ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {showGift && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      We'll send the credit code to both you and your recipient.
                    </p>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" htmlFor="fs-gift-name">
                        Recipient's Name
                      </label>
                      <input
                        id="fs-gift-name"
                        data-testid="input-gift-name"
                        type="text"
                        placeholder="John Doe"
                        value={form.gift_recipient_name}
                        onChange={(e) => set("gift_recipient_name", e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" htmlFor="fs-gift-email">
                        Recipient's Email
                      </label>
                      <input
                        id="fs-gift-email"
                        data-testid="input-gift-email"
                        type="email"
                        placeholder="john@example.com"
                        value={form.gift_recipient_email}
                        onChange={(e) => set("gift_recipient_email", e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" htmlFor="fs-gift-message">
                        Personal Message <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <textarea
                        id="fs-gift-message"
                        data-testid="input-gift-message"
                        rows={3}
                        maxLength={500}
                        placeholder="Happy birthday! Hope this helps with your next car purchase."
                        value={form.gift_message}
                        onChange={(e) => set("gift_message", e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="checkbox-terms"
                    required
                    checked={form.terms_accepted}
                    onChange={(e) => set("terms_accepted", e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-emerald-600"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I understand this purchase is non-refundable. Credits are valid for 24 months and are not redeemable for cash.
                    By purchasing I accept the{" "}
                    <a href="/terms" className="text-emerald-700 hover:underline">Terms of Service</a>.
                  </span>
                </label>

                {error && (
                  <div
                    data-testid="error-message"
                    className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive"
                  >
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  data-testid="button-submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 text-base"
                >
                  {submitting
                    ? "Redirecting to checkout…"
                    : `Support RideCheck — $${tier.amountCents / 100}`}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Secured by Stripe. We never store your card details.
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Trust signals */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              { label: "Stripe Secured", sub: "PCI-compliant payments" },
              { label: "Non-Refundable", sub: "Credits are final sale" },
              { label: "No Expiry Surprises", sub: "24-month validity" },
              { label: "Fully Transferable", sub: "Gift to anyone" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
