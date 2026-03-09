"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState, useEffect } from "react";
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
import { Check, ArrowLeft, ArrowRight, Shield, Globe, MapPin, CheckCircle2, XCircle, Car, Info } from "lucide-react";
import {
  PACKAGE_INFO,
  PRICING,
  formatCurrency,
  detectListingPlatform,
  type PackageType,
  type BookingType,
} from "@/lib/utils/pricing";
import { classifyVehicle, type ClassificationResult, TIER_PRICES } from "@/lib/vehicleClassification";
import { isBuyerArrangedEnabled } from "@/lib/utils/featureFlags";
import { getServiceAreaFromZip } from "@/lib/geo/resolveCounty";
import { t, type Language } from "@/lib/i18n/translations";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function BookPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <BookInner />
    </Suspense>
  );
}

function BookInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const buyerArrangedEnabled = isBuyerArrangedEnabled();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<Language>(
    (searchParams.get("lang") === "es" ? "es" : "en") as Language
  );

  const STEPS = [
    t("booking.step.vehicle", lang),
    t("booking.step.details", lang),
    t("booking.step.review", lang),
  ];

  const [bookingType, setBookingType] = useState<BookingType>("concierge");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [vehicleMileage, setVehicleMileage] = useState("");
  const [vehiclePrice, setVehiclePrice] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [vehicleLocation, setVehicleLocation] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmailInput, setBuyerEmailInput] = useState("");

  const [inspectionAddress, setInspectionAddress] = useState("");
  const [inspectionTimeWindow, setInspectionTimeWindow] = useState("");
  const [notesToInspector, setNotesToInspector] = useState("");

  const [serviceZip, setServiceZip] = useState("");
  const [zipStatus, setZipStatus] = useState<"idle" | "valid" | "invalid">("idle");

  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [useTestPackage, setUseTestPackage] = useState(false);

  const isBuyerArranged = bookingType === "buyer_arranged";

  const pkg: PackageType = useTestPackage ? "test" : (classification?.packageTier || "standard") as PackageType;
  const finalPrice = useTestPackage ? 1 : (classification?.basePrice || TIER_PRICES.standard);

  useEffect(() => {
    if (vehicleMake && vehicleModel && vehicleYear) {
      const result = classifyVehicle({
        make: vehicleMake,
        model: vehicleModel,
        year: parseInt(vehicleYear) || new Date().getFullYear(),
        mileage: vehicleMileage ? parseInt(vehicleMileage) : null,
        askingPrice: vehiclePrice ? parseFloat(vehiclePrice) : null,
      });
      setClassification(result);
    } else {
      setClassification(null);
    }
  }, [vehicleMake, vehicleModel, vehicleYear, vehicleMileage, vehiclePrice]);

  const handleZipChange = (zip: string) => {
    const cleaned = zip.replace(/\D/g, "").slice(0, 5);
    setServiceZip(cleaned);
    if (cleaned.length === 5) {
      const result = getServiceAreaFromZip(cleaned);
      setZipStatus(result.isAllowed ? "valid" : "invalid");
    } else {
      setZipStatus("idle");
    }
  };

  const canProceed = () => {
    if (step === 0)
      return (
        !!vehicleYear && !!vehicleMake && !!vehicleModel && !!vehicleLocation &&
        zipStatus === "valid" && !!bookingType
      );
    if (step === 1) {
      if (!buyerPhone || buyerPhone.length < 7) return false;
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
        buyer_phone: buyerPhone,
        buyer_email_input: buyerEmailInput || null,
        booking_type: isBuyerArranged ? "self_arrange" : bookingType,
        preferred_date: preferredDate || null,
        booking_method: isBuyerArranged ? "buyer_arranged" : "concierge",
        preferred_language: lang,
        listing_platform: listingPlatform,
        service_zip: serviceZip,
        vehicle_mileage: vehicleMileage ? parseInt(vehicleMileage) : null,
        vehicle_price: vehiclePrice ? parseFloat(vehiclePrice) : null,
        ...(useTestPackage && { package: "test" }),
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
        if (err.error === "service_unavailable" || err.error === "county_locked" || err.error === "pilot_capacity_reached" || err.error === "county_cap_reached") {
          throw new Error(err.message || "Service not available in this area");
        }
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 mb-8" data-testid="banner-pilot-mode">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                Pilot Mode: Lake County, IL only
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
                We&apos;re rolling out in phases. Confirm availability with your ZIP before booking.
              </p>
            </div>
          </div>
        </div>
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

            <div className="space-y-4">
              <Label className="text-base font-semibold block">
                Vehicle Information
              </Label>
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
                    onChange={(e) => setVehicleMake(e.target.value)}
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
                    onChange={(e) => setVehicleModel(e.target.value)}
                    data-testid="input-model"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mileage">Mileage</Label>
                  <Input
                    id="mileage"
                    type="number"
                    placeholder="85000"
                    value={vehicleMileage}
                    onChange={(e) => setVehicleMileage(e.target.value)}
                    data-testid="input-mileage"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Helps determine the best package for your vehicle</p>
                </div>
                <div>
                  <Label htmlFor="askingPrice">Asking Price ($)</Label>
                  <Input
                    id="askingPrice"
                    type="number"
                    placeholder="15000"
                    value={vehiclePrice}
                    onChange={(e) => setVehiclePrice(e.target.value)}
                    data-testid="input-asking-price"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used for accurate package classification</p>
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
                <Label htmlFor="serviceZip">Service ZIP Code *</Label>
                <Input
                  id="serviceZip"
                  placeholder="60045"
                  value={serviceZip}
                  onChange={(e) => handleZipChange(e.target.value)}
                  maxLength={5}
                  className="max-w-[200px]"
                  data-testid="input-service-zip"
                />
                {zipStatus === "valid" && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1.5 flex items-center gap-1.5" data-testid="text-zip-valid">
                    <CheckCircle2 className="h-4 w-4" />
                    Available in Lake County
                  </p>
                )}
                {zipStatus === "invalid" && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1.5" data-testid="text-zip-invalid">
                    <XCircle className="h-4 w-4" />
                    Not available yet — we&apos;re launching in phases (Lake → McHenry → Cook)
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="description">
                  {t("booking.vehicleDescription", lang)}
                </Label>
                <Textarea
                  id="description"
                  placeholder="Any details about the vehicle (color, trim, notable features, etc.)"
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

            {classification && !useTestPackage && (
              <Card className="border-primary/50 bg-primary/5" data-testid="card-vehicle-package">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <Car className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold">
                            Vehicle Required Package: {PACKAGE_INFO[classification.packageTier as PackageType]?.name || classification.packageTier}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {PACKAGE_INFO[classification.packageTier as PackageType]?.tagline}
                          </p>
                        </div>
                        <span className="text-lg font-bold" data-testid="text-determined-price">
                          {formatCurrency(classification.basePrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {(!vehicleMileage || !vehiclePrice) && (
                    <div className="flex items-start gap-2 mt-3 pt-3 border-t border-primary/20">
                      <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Add mileage and asking price above for the most accurate package match.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {useTestPackage && (
              <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30" data-testid="card-test-package">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            $1 Test Package Selected
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                            Internal testing — full end-to-end flow for $1
                          </p>
                        </div>
                        <span className="text-lg font-bold text-amber-900 dark:text-amber-200" data-testid="text-determined-price">
                          $1
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card
              className={`cursor-pointer transition-colors hover-elevate border-dashed ${
                useTestPackage ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : "border-muted-foreground/30"
              }`}
              onClick={() => setUseTestPackage(!useTestPackage)}
              data-testid="card-toggle-test-package"
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      useTestPackage
                        ? "border-amber-500 bg-amber-500"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {useTestPackage && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Use $1 Test Package</p>
                    <p className="text-xs text-muted-foreground">
                      For internal testing only — overrides vehicle classification with $1 pricing
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 1 && (
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
            <div className="pt-4 border-t space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Your contact info (for payment link)</p>
              <div>
                <Label htmlFor="buyerPhone">Your Phone Number *</Label>
                <Input
                  id="buyerPhone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  data-testid="input-buyer-phone"
                />
                <p className="text-xs text-muted-foreground mt-1">We&apos;ll text you a secure payment link</p>
              </div>
              <div>
                <Label htmlFor="buyerEmail">Your Email (optional)</Label>
                <Input
                  id="buyerEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={buyerEmailInput}
                  onChange={(e) => setBuyerEmailInput(e.target.value)}
                  data-testid="input-buyer-email"
                />
              </div>
            </div>
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

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("booking.orderSummary", lang)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Package
                </span>
                <span className={`font-medium ${useTestPackage ? "text-amber-600" : ""}`}>
                  {PACKAGE_INFO[pkg]?.name || pkg}
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
              {vehicleMileage && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mileage</span>
                  <span>{parseInt(vehicleMileage).toLocaleString()} mi</span>
                </div>
              )}
              {vehiclePrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Asking Price</span>
                  <span>{formatCurrency(parseFloat(vehiclePrice))}</span>
                </div>
              )}
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Phone</span>
                <span data-testid="text-review-phone">{buyerPhone}</span>
              </div>
              {buyerEmailInput && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your Email</span>
                  <span data-testid="text-review-email">{buyerEmailInput}</span>
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
                <div className="flex justify-between font-bold text-base">
                  <span>{t("booking.total", lang)}</span>
                  <span data-testid="text-review-total">{formatCurrency(finalPrice)}</span>
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
