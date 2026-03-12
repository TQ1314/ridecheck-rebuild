import Link from "next/link";
import { HeroSlideshow } from "@/components/ui/hero-slideshow";
import type { Metadata } from "next";
import { t } from "@/lib/i18n/translations";
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

const L = "es" as const;

export const metadata: Metadata = {
  title: "RideCheck — No compres a ciegas. Hazle un RideCheck.",
  description:
    "RideCheck envía un mecánico local para inspeccionar un carro usado antes de que lo compres.",
};

export default function SpanishHomePage() {
  return (
    <main className="bg-white text-gray-900">

      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 to-white" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2 md:py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              {t("home.badge", L)}
            </div>

            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
              {t("home.headline", L)} <span className="text-emerald-700">{t("home.headlineBrand", L)}</span>
            </h1>

            <p className="mt-4 text-lg font-medium leading-relaxed text-gray-800">
              {t("home.subheadline", L)}
            </p>

            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {t("home.bullet1", L)}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {t("home.bullet2", L)}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {t("home.bullet3", L)}
              </li>
            </ul>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/es/book"
                data-testid="link-book-hero-es"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                {t("home.ctaBook", L)}
              </a>
              <a
                href="#how-it-works"
                data-testid="link-how-it-works-es"
                className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-gray-50"
              >
                {t("home.ctaHow", L)}
              </a>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label={t("home.stat1Label", L)} value={t("home.stat1Value", L)} sub={t("home.stat1Sub", L)} />
              <Stat label={t("home.stat2Label", L)} value={t("home.stat2Value", L)} sub={t("home.stat2Sub", L)} />
              <Stat label={t("home.stat3Label", L)} value={t("home.stat3Value", L)} sub={t("home.stat3Sub", L)} />
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <HeroSlideshow />

            <div className="mt-4 rounded-xl border bg-emerald-50 p-4">
              <div className="text-sm font-semibold text-emerald-800">{t("home.quickTitle", L)}</div>
              <ol className="mt-2 space-y-1.5 text-sm text-gray-700">
                <li><span className="font-bold text-emerald-700">1.</span> {t("home.quick1", L)}</li>
                <li><span className="font-bold text-emerald-700">2.</span> {t("home.quick2", L)}</li>
                <li><span className="font-bold text-emerald-700">3.</span> {t("home.quick3", L)}</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ========== UGC VIDEO ========== */}
      <section className="border-t bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <h2 className="text-2xl font-extrabold md:text-3xl">Mira RideCheck en Acción</h2>
          <p className="mt-3 max-w-2xl mx-auto text-gray-700">
            Mira cómo RideCheck ayuda a compradores a evitar errores costosos antes de comprar un carro usado.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <video
              src="/videos/dillon-ugc-v2.mp4"
              controls
              playsInline
              muted
              className="w-full max-h-[560px] object-contain"
              data-testid="video-ugc-dillon-es"
            />
          </div>

          <div className="mt-6">
            <a
              href="/es/book"
              data-testid="link-book-ugc-es"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Reservar un RideCheck →
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-extrabold md:text-3xl">{t("home.howTitle", L)}</h2>
        <p className="mt-3 max-w-3xl text-gray-700">
          {t("home.howSubtitle", L)}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StepCard
            icon={<Car className="h-6 w-6 text-emerald-600" />}
            step="01"
            title={t("home.step1Title", L)}
            desc={t("home.step1Desc", L)}
          />
          <StepCard
            icon={<Phone className="h-6 w-6 text-emerald-600" />}
            step="02"
            title={t("home.step2Title", L)}
            desc={t("home.step2Desc", L)}
          />
          <StepCard
            icon={<ClipboardCheck className="h-6 w-6 text-emerald-600" />}
            step="03"
            title={t("home.step3Title", L)}
            desc={t("home.step3Desc", L)}
          />
          <StepCard
            icon={<FileText className="h-6 w-6 text-emerald-600" />}
            step="04"
            title={t("home.step4Title", L)}
            desc={t("home.step4Desc", L)}
          />
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/what-we-check"
            data-testid="link-what-we-check-es"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
          >
            {t("home.seeCheck", L)} <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="hidden text-gray-300 sm:inline">|</span>
          <a
            href="/ridecheck-sample-report.html"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-sample-report-es"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
          >
            <FileText className="h-4 w-4" /> {t("home.sampleReport", L)}
          </a>
        </div>
      </section>

      <section className="border-t bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-extrabold md:text-3xl">{t("home.whenTitle", L)}</h2>
          <p className="mt-3 max-w-3xl text-gray-700">
            {t("home.whenSubtitle", L)}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Scenario icon={<MapPin className="h-5 w-5 text-emerald-600" />} text={t("home.when1", L)} />
            <Scenario icon={<Car className="h-5 w-5 text-emerald-600" />} text={t("home.when2", L)} />
            <Scenario icon={<Eye className="h-5 w-5 text-emerald-600" />} text={t("home.when3", L)} />
            <Scenario icon={<Search className="h-5 w-5 text-emerald-600" />} text={t("home.when4", L)} />
            <Scenario icon={<AlertTriangle className="h-5 w-5 text-emerald-600" />} text={t("home.when5", L)} />
            <Scenario icon={<Shield className="h-5 w-5 text-emerald-600" />} text={t("home.when6", L)} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-extrabold md:text-3xl">{t("home.risksTitle", L)}</h2>
        <p className="mt-3 max-w-3xl text-gray-700">
          {t("home.risksSubtitle", L)}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <RiskItem text={t("home.risk1", L)} />
          <RiskItem text={t("home.risk2", L)} />
          <RiskItem text={t("home.risk3", L)} />
          <RiskItem text={t("home.risk4", L)} />
          <RiskItem text={t("home.risk5", L)} />
          <RiskItem text={t("home.risk6", L)} />
        </div>
      </section>

      <section className="border-t bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-extrabold md:text-3xl">{t("home.pricingTitle", L)}</h2>
          <p className="mt-3 max-w-3xl text-gray-700">
            {t("home.pricingSubtitle", L)}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <PriceCard tier={t("home.tierStandard", L)} price="$139" desc={t("home.tierStandardDesc", L)} />
            <PriceCard tier={t("home.tierPlus", L)} price="$169" desc={t("home.tierPlusDesc", L)} highlight />
            <PriceCard tier={t("home.tierPremium", L)} price="$189" desc={t("home.tierPremiumDesc", L)} />
            <PriceCard tier={t("home.tierExotic", L)} price="$299" desc={t("home.tierExoticDesc", L)} />
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/pricing"
              data-testid="link-pricing-details-es"
              className="text-sm font-semibold text-emerald-700 hover:underline"
            >
              {t("home.pricingLink", L)}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-extrabold md:text-3xl">{t("home.isTitle", L)}</h2>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border bg-emerald-50 p-6">
            <div className="text-sm font-bold text-emerald-800">{t("home.isLabel", L)}</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {t("home.is1", L)}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {t("home.is2", L)}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {t("home.is3", L)}
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-6">
            <div className="text-sm font-bold text-gray-600">{t("home.isNotLabel", L)}</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                {t("home.isNot1", L)}
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                {t("home.isNot2", L)}
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                {t("home.isNot3", L)}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-700 p-8 text-white md:p-12">
            <h2 className="text-2xl font-extrabold md:text-4xl">{t("home.finalHeadline", L)}</h2>
            <p className="mt-3 max-w-2xl text-lg text-white/90">
              {t("home.finalSubtitle", L)}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/es/book"
                data-testid="link-book-footer-es"
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50"
              >
                {t("home.finalCta1", L)}
              </a>
              <a
                href="/pricing"
                data-testid="link-pricing-footer-es"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                {t("home.finalCta2", L)}
              </a>
            </div>

            <p className="mt-5 text-xs text-white/70">
              {t("home.finalDisclaimer", L)}
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            {t("home.faqPrompt", L)}{" "}
            <Link href="/faq" className="font-semibold text-emerald-700 hover:underline">
              {t("home.faqLink", L)}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

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
