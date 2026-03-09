"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/lib/i18n/translations";
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

const L = "es" as const;

const SELF_STEPS = [
  { icon: ClipboardList, titleKey: "howItWorks.self1Title", descKey: "howItWorks.self1Desc" },
  { icon: CreditCard, titleKey: "howItWorks.self2Title", descKey: "howItWorks.self2Desc" },
  { icon: Wrench, titleKey: "howItWorks.self3Title", descKey: "howItWorks.self3Desc" },
  { icon: FileText, titleKey: "howItWorks.self4Title", descKey: "howItWorks.self4Desc" },
];

const CONCIERGE_STEPS = [
  { icon: ClipboardList, titleKey: "howItWorks.con1Title", descKey: "howItWorks.con1Desc" },
  { icon: Phone, titleKey: "howItWorks.con2Title", descKey: "howItWorks.con2Desc" },
  { icon: CreditCard, titleKey: "howItWorks.con3Title", descKey: "howItWorks.con3Desc" },
  { icon: Calendar, titleKey: "howItWorks.con4Title", descKey: "howItWorks.con4Desc" },
  { icon: Wrench, titleKey: "howItWorks.con5Title", descKey: "howItWorks.con5Desc" },
  { icon: FileText, titleKey: "howItWorks.con6Title", descKey: "howItWorks.con6Desc" },
];

export default function SpanishHowItWorksPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold mb-3">{t("howItWorks.title", L)}</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("howItWorks.subtitle", L)}
          </p>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            {t("howItWorks.selfTitle", L)}
          </h2>
          <p className="text-muted-foreground mb-6">
            {t("howItWorks.selfSubtitle", L)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SELF_STEPS.map((step) => (
              <Card key={step.titleKey}>
                <CardContent className="flex items-start gap-4 pt-5 pb-5">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{t(step.titleKey, L)}</h3>
                    <p className="text-sm text-muted-foreground">{t(step.descKey, L)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            {t("howItWorks.conciergeTitle", L)}
          </h2>
          <p className="text-muted-foreground mb-6">
            {t("howItWorks.conciergeSubtitle", L)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONCIERGE_STEPS.map((step) => (
              <Card key={step.titleKey}>
                <CardContent className="flex items-start gap-4 pt-5 pb-5">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{t(step.titleKey, L)}</h3>
                    <p className="text-sm text-muted-foreground">{t(step.descKey, L)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="text-center py-10 rounded-lg bg-muted/50">
          <h2 className="text-2xl font-bold mb-3">{t("howItWorks.ctaTitle", L)}</h2>
          <p className="text-muted-foreground mb-6">
            {t("howItWorks.ctaSubtitle", L)}
          </p>
          <Link href="/es/book">
            <Button size="lg" data-testid="button-book-cta-es">
              {t("howItWorks.ctaButton", L)}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
