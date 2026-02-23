"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Copy, Check, Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t, type Language } from "@/lib/i18n/translations";

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams();

  const orderId = searchParams.get("order_id");
  const method = searchParams.get("method") || "concierge";
  const initialLang = (searchParams.get("lang") || "en") as Language;

  const [lang, setLang] = useState<Language>(initialLang);
  const [copied, setCopied] = useState(false);

  const isBuyerArranged = method === "buyer_arranged";

  // ✅ Buyer-safe tracking URL (Option 2)
  // Priority:
  // 1) explicit ?track=... (if you ever pass it)
  // 2) fallback to /track/{orderId}
  const trackUrl =
    searchParams.get("track") ||
    (orderId ? `/track/${encodeURIComponent(orderId)}` : null);

  const handleCopyScript = () => {
    const script = t("confirm.sellerScript.body", lang, {
      sellerName: "the seller",
      address: "the scheduled location",
      timeWindow: "the agreed time",
    });

    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-lg px-4 sm:px-6">
        <div className="flex justify-end mb-4">
          <div className="flex items-center gap-1">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={lang} onValueChange={(v) => setLang(v as Language)}>
              <SelectTrigger
                className="w-20"
                data-testid="select-language-confirm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">EN</SelectItem>
                <SelectItem value="es">ES</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="pt-10 pb-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>

            <h1 className="text-2xl font-bold mb-2">
              {t("confirm.title", lang)}
            </h1>

            {orderId && (
              <p
                className="font-mono text-sm text-muted-foreground mb-4"
                data-testid="text-order-id"
              >
                Order ID: {orderId}
              </p>
            )}

            <p className="text-muted-foreground mb-4">
              {t("confirm.subtitle", lang)}
            </p>

            <p className="text-sm text-muted-foreground mb-8">
              {t("confirm.email", lang)}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {orderId && (
                <Link href={`/orders/${encodeURIComponent(orderId)}`}>
                  <Button data-testid="button-view-order">
                    {t("confirm.viewOrder", lang)}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}

              {trackUrl && (
                <Link href={trackUrl}>
                  <Button variant="outline" data-testid="button-track-order">
                    Track Order
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">
              {isBuyerArranged
                ? t("confirm.nextSteps.buyerArranged.title", lang)
                : t("confirm.nextSteps.concierge.title", lang)}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <ol className="space-y-3 text-sm list-decimal list-inside">
              {isBuyerArranged ? (
                <>
                  <li className="text-muted-foreground">
                    {t("confirm.nextSteps.buyerArranged.1", lang)}
                  </li>
                  <li className="text-muted-foreground">
                    {t("confirm.nextSteps.buyerArranged.2", lang)}
                  </li>
                  <li className="text-muted-foreground">
                    {t("confirm.nextSteps.buyerArranged.3", lang)}
                  </li>
                </>
              ) : (
                <>
                  <li className="text-muted-foreground">
                    {t("confirm.nextSteps.concierge.1", lang)}
                  </li>
                  <li className="text-muted-foreground">
                    {t("confirm.nextSteps.concierge.2", lang)}
                  </li>
                  <li className="text-muted-foreground">
                    {t("confirm.nextSteps.concierge.3", lang)}
                  </li>
                  <li className="text-muted-foreground">
                    {t("confirm.nextSteps.concierge.4", lang)}
                  </li>
                </>
              )}
            </ol>
          </CardContent>
        </Card>

        {isBuyerArranged && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">
                {t("confirm.sellerScript.title", lang)}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground mb-4">
                {t("confirm.sellerScript.body", lang, {
                  sellerName: "the seller",
                  address: "the scheduled location",
                  timeWindow: "the agreed time",
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyScript}
                data-testid="button-copy-script"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    {t("confirm.sellerScript.copied", lang)}
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    {t("confirm.sellerScript.copy", lang)}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}