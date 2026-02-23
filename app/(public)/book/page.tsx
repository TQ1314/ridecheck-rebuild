"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ArrowLeft, ArrowRight, Shield, Globe } from "lucide-react";
import {
  PACKAGE_INFO,
  PRICING,
  getPrice,
  getPackageTier,
  detectListingPlatform,
  formatCurrency,
  type PackageType,
  type BookingType,
} from "@/lib/utils/pricing";
import { isBuyerArrangedEnabled } from "@/lib/utils/featureFlags";
import { t, type Language } from "@/lib/i18n/translations";
import { useToast } from "@/hooks/use-toast";

export default function BookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const buyerArrangedEnabled = isBuyerArrangedEnabled();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<Language>("en");

  const STEPS = [
    t("booking.step.package", lang),
    t("booking.step.vehicle", lang),
    t("booking.step.details", lang),
    t("booking.step.review", lang),
  ];

  const [bookingType, setBookingType] = useState<BookingType>("concierge");
  const [pkg, setPkg] = useState<PackageType>(
    (searchParams.get("package") as PackageType) || "standard",
  );
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [vehicleLocation, setVehicleLocation] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [preferredDate, setPreferredDate] = useState("");

  const [inspectionAddress, setInspectionAddress] = useState("");
  const [inspectionTimeWindow, setInspectionTimeWindow] = useState("");
  const [notesToInspector, setNotesToInspector] = useState("");

  const [tierSuggestion, setTierSuggestion] = useState<string | null>(null);

  const isBuyerArranged = bookingType === "buyer_arranged";
  const effectiveBookingType: BookingType = isBuyerArranged
    ? "self_arrange"
    : bookingType;

  const { basePrice, finalPrice, discountAmount } = getPrice(
    pkg,
    effectiveBookingType,
  );

  const handleVehicleChange = (make: string, model: string) => {
    if (make && model) {
      const suggestedTier = getPackageTier({ make, model });
      if (suggestedTier !== "standard") {
        setTierSuggestion(suggestedTier);
        setPkg(suggestedTier as PackageType);
      } else {
        setTierSuggestion(null);
      }
    }
  };

  const canProceed = () => {
    if (step === 0) return !!pkg && !!bookingType;
    if (step === 1)
      return (
        !!vehicleYear && !!vehicleMake && !!vehicleModel && !!vehicleLocation
      );
    if (step === 2) {
      if (isBuyerArranged) {
        return !!inspectionAddress && !!inspectionTimeWindow && !!sellerPhone;
      }
      return true;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const idempotencyKey = crypto.randomUUID();

      const listingPlatform = listingUrl
        ? detectListingPlatform(listingUrl)
        : null;

      const body: Record<string, any> = {
        vehicle_year: parseInt(vehicleYear),
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_description: vehicleDescription || null,
        listing_url: listingUrl || null,
        vehicle_location: vehicleLocation,
        seller_name: sellerName || null,
        seller_phone: sellerPhone || null,
        booking_type: isBuyerArranged ? "self_arrange" : bookingType,
        package: pkg,
        preferred_date: preferredDate || null,
        booking_method: isBuyerArranged ? "buyer_arranged" : "concierge",
        preferred_language: lang,
        listing_platform: listingPlatform,
        package_tier: pkg,
      };

      if (isBuyerArranged) {
        body.inspection_address = inspectionAddress;
        body.inspection_time_window = inspectionTimeWindow;
        body.notes_to_inspector = notesToInspector || null;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      };

      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create order");
      }

      const data = await res.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      const trackParam = data.track_url ? `&track=${encodeURIComponent(data.track_url)}` : "";
      const confirmUrl = `/order/confirmation?order_id=${data.order.id}&lang=${lang}&method=${isBuyerArranged ? "buyer_arranged" : "concierge"}${trackParam}`;
      router.push(confirmUrl);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const availablePackages: PackageType[] = [
    "standard",
    "plus",
    "premium",
    "comprehensive",
  ];

  const availableBookingTypes: { value: BookingType; label: string; desc: string }[] = [];

  if (buyerArrangedEnabled) {
    availableBookingTypes.push({
      value: "buyer_arranged",
      label: t("booking.buyerArranged", lang),
      desc: t("booking.buyerArranged.desc", lang),
    });
  }

  availableBookingTypes.push(
    {
      value: "self_arrange",
      label: t("booking.selfArrange", lang),
      desc: t("booking.selfArrange.desc", lang),
    },
    {
      value: "concierge",
      label: t("booking.concierge", lang),
      desc: t("booking.concierge.desc", lang),
    },
  );

  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-center justify-between mb-10">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold mb-2">
              {t("booking.title", lang)}
            </h1>
            <p className="text-muted-foreground">
              {t("booking.subtitle", lang)}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select
              value={lang}
              onValueChange={(v) => setLang(v as Language)}
            >
              <SelectTrigger
                className="w-20"
                data-testid="select-language"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en" data-testid="option-lang-en">
                  EN
                </SelectItem>
                <SelectItem value="es" data-testid="option-lang-es">
                  ES
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors ${
                  i <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-sm hidden sm:inline ${i <= step ? "font-medium" : "text-muted-foreground"}`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <div className="w-8 h-px bg-border" />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-semibold mb-3 block">
                {t("booking.bookingType", lang)}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableBookingTypes.map((bt) => (
                  <Card
                    key={bt.value}
                    className={`cursor-pointer transition-colors hover-elevate ${
                      bookingType === bt.value ? "border-primary" : ""
                    }`}
                    onClick={() => setBookingType(bt.value)}
                    data-testid={`card-booking-${bt.value}`}
                  >
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            bookingType === bt.value
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {bookingType === bt.value && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">
                            {bt.label}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {bt.desc}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-semibold mb-3 block">
                {t("booking.package", lang)}
              </Label>
              <div className="grid grid-cols-1 gap-3">
                {availablePackages.map((p) => {
                  const info = PACKAGE_INFO[p];
                  const price = getPrice(p, effectiveBookingType);
                  return (
                    <Card
                      key={p}
                      className={`cursor-pointer transition-colors hover-elevate ${
                        pkg === p ? "border-primary" : ""
                      }`}
                      onClick={() => setPkg(p)}
                      data-testid={`card-package-${p}`}
                    >
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              pkg === p
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {pkg === p && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm">
                                {info.name}
                              </h3>
                              <span className="font-bold">
                                {p === "comprehensive"
                                  ? `${formatCurrency(price.finalPrice)}+`
                                  : formatCurrency(price.finalPrice)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {info.tagline}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {tierSuggestion && (
                <p
                  className="text-sm text-primary mt-3"
                  data-testid="text-tier-suggestion"
                >
                  {t("booking.tierSuggestion", lang, {
                    tier: PACKAGE_INFO[tierSuggestion as PackageType]?.name || tierSuggestion,
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="year">
                  {t("booking.vehicleYear", lang)} *
                </Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="2020"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  data-testid="input-year"
                />
              </div>
              <div>
                <Label htmlFor="make">
                  {t("booking.vehicleMake", lang)} *
                </Label>
                <Input
                  id="make"
                  placeholder="Toyota"
                  value={vehicleMake}
                  onChange={(e) => {
                    setVehicleMake(e.target.value);
                    handleVehicleChange(e.target.value, vehicleModel);
                  }}
                  data-testid="input-make"
                />
              </div>
              <div>
                <Label htmlFor="model">
                  {t("booking.vehicleModel", lang)} *
                </Label>
                <Input
                  id="model"
                  placeholder="Camry"
                  value={vehicleModel}
                  onChange={(e) => {
                    setVehicleModel(e.target.value);
                    handleVehicleChange(vehicleMake, e.target.value);
                  }}
                  data-testid="input-model"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="location">
                {t("booking.vehicleLocation", lang)} *
              </Label>
              <Input
                id="location"
                placeholder="City, State or full address"
                value={vehicleLocation}
                onChange={(e) => setVehicleLocation(e.target.value)}
                data-testid="input-location"
              />
            </div>
            <div>
              <Label htmlFor="description">
                {t("booking.vehicleDescription", lang)}
              </Label>
              <Textarea
                id="description"
                placeholder="Any details about the vehicle (mileage, color, trim, etc.)"
                value={vehicleDescription}
                onChange={(e) => setVehicleDescription(e.target.value)}
                data-testid="input-description"
              />
            </div>
            <div>
              <Label htmlFor="listing">
                {t("booking.listingUrl", lang)}
              </Label>
              <Input
                id="listing"
                type="url"
                placeholder="https://..."
                value={listingUrl}
                onChange={(e) => setListingUrl(e.target.value)}
                data-testid="input-listing-url"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {isBuyerArranged && (
              <>
                <div>
                  <Label htmlFor="inspectionAddress">
                    {t("booking.inspectionAddress", lang)} *
                  </Label>
                  <Input
                    id="inspectionAddress"
                    placeholder="Full address for the assessment"
                    value={inspectionAddress}
                    onChange={(e) => setInspectionAddress(e.target.value)}
                    data-testid="input-inspection-address"
                  />
                </div>
                <div>
                  <Label htmlFor="inspectionTimeWindow">
                    {t("booking.inspectionTimeWindow", lang)} *
                  </Label>
                  <Input
                    id="inspectionTimeWindow"
                    placeholder="e.g., Saturday 10am-2pm"
                    value={inspectionTimeWindow}
                    onChange={(e) => setInspectionTimeWindow(e.target.value)}
                    data-testid="input-inspection-time"
                  />
                </div>
                <div>
                  <Label htmlFor="sellerPhone">
                    {t("booking.sellerPhone", lang)} *
                  </Label>
                  <Input
                    id="sellerPhone"
                    placeholder="(555) 123-4567"
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    data-testid="input-seller-phone"
                  />
                </div>
                <div>
                  <Label htmlFor="sellerName">
                    {t("booking.sellerName", lang)}
                  </Label>
                  <Input
                    id="sellerName"
                    placeholder="John Doe"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    data-testid="input-seller-name"
                  />
                </div>
                <div>
                  <Label htmlFor="notesToInspector">
                    {t("booking.notesToInspector", lang)}
                  </Label>
                  <Textarea
                    id="notesToInspector"
                    placeholder="Any special instructions for the inspector..."
                    value={notesToInspector}
                    onChange={(e) => setNotesToInspector(e.target.value)}
                    data-testid="input-notes-inspector"
                  />
                </div>
              </>
            )}
            {bookingType === "concierge" && (
              <>
                <div>
                  <Label htmlFor="sellerName">
                    {t("booking.sellerName", lang)}
                  </Label>
                  <Input
                    id="sellerName"
                    placeholder="John Doe"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    data-testid="input-seller-name"
                  />
                </div>
                <div>
                  <Label htmlFor="sellerPhone">
                    {t("booking.sellerPhone", lang)}
                  </Label>
                  <Input
                    id="sellerPhone"
                    placeholder="(555) 123-4567"
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    data-testid="input-seller-phone"
                  />
                </div>
              </>
            )}
            {bookingType === "self_arrange" && (
              <>
                <div>
                  <Label htmlFor="sellerPhone">
                    {t("booking.sellerPhone", lang)}
                  </Label>
                  <Input
                    id="sellerPhone"
                    placeholder="(555) 123-4567"
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    data-testid="input-seller-phone"
                  />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="date">
                {t("booking.preferredDate", lang)}
              </Label>
              <Input
                id="date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                data-testid="input-preferred-date"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("booking.orderSummary", lang)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("booking.package", lang)}
                </span>
                <span className="font-medium">
                  {PACKAGE_INFO[pkg].name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("booking.bookingType", lang)}
                </span>
                <span>
                  {isBuyerArranged
                    ? t("booking.buyerArranged", lang)
                    : bookingType === "self_arrange"
                      ? t("booking.selfArrange", lang)
                      : t("booking.concierge", lang)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("booking.step.vehicle", lang)}
                </span>
                <span>
                  {vehicleYear} {vehicleMake} {vehicleModel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("booking.vehicleLocation", lang)}
                </span>
                <span>{vehicleLocation}</span>
              </div>
              {isBuyerArranged && inspectionAddress && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("booking.inspectionAddress", lang)}
                  </span>
                  <span>{inspectionAddress}</span>
                </div>
              )}
              {isBuyerArranged && inspectionTimeWindow && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("booking.inspectionTimeWindow", lang)}
                  </span>
                  <span>{inspectionTimeWindow}</span>
                </div>
              )}
              {preferredDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("booking.preferredDate", lang)}
                  </span>
                  <span>{preferredDate}</span>
                </div>
              )}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("booking.basePrice", lang)}
                  </span>
                  <span>{formatCurrency(basePrice)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>
                      {isBuyerArranged
                        ? t("booking.discount", lang)
                        : t("booking.selfDiscount", lang)}
                    </span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base mt-2">
                  <span>{t("booking.total", lang)}</span>
                  <span>{formatCurrency(finalPrice)}</span>
                </div>
              </div>
              {bookingType === "concierge" && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 mt-2">
                  {t("booking.conciergeNote", lang)}
                </p>
              )}
              {(bookingType === "self_arrange" || isBuyerArranged) && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 mt-2">
                  {isBuyerArranged
                    ? t("booking.buyerArrangedNote", lang)
                    : t("booking.selfNote", lang)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("booking.back", lang)}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              data-testid="button-next"
            >
              {t("booking.next", lang)}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              data-testid="button-submit-order"
            >
              {loading
                ? t("booking.submitting", lang)
                : t("booking.submit", lang)}
              <Shield className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
