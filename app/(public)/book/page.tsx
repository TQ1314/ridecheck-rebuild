"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ArrowLeft, ArrowRight, Shield, Phone, User } from "lucide-react";
import {
  PACKAGE_INFO,
  PRICING,
  getPrice,
  formatCurrency,
  type PackageType,
  type BookingType,
} from "@/lib/utils/pricing";
import { useToast } from "@/hooks/use-toast";

const STEPS = ["Package", "Vehicle", "Details", "Review"];

export default function BookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [bookingType, setBookingType] = useState<BookingType>("self_arrange");
  const [pkg, setPkg] = useState<PackageType>(
    (searchParams.get("package") as PackageType) || "premium",
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

  const { basePrice, finalPrice, discountAmount } = getPrice(pkg, bookingType);

  const canProceed = () => {
    if (step === 0) return !!pkg && !!bookingType;
    if (step === 1)
      return !!vehicleYear && !!vehicleMake && !!vehicleModel && !!vehicleLocation;
    if (step === 2) return true;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const idempotencyKey = crypto.randomUUID();

      const body = {
        vehicle_year: parseInt(vehicleYear),
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_description: vehicleDescription || null,
        listing_url: listingUrl || null,
        vehicle_location: vehicleLocation,
        seller_name: sellerName || null,
        seller_phone: sellerPhone || null,
        booking_type: bookingType,
        package: pkg,
        preferred_date: preferredDate || null,
      };

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
      router.push(`/order/received?orderId=${data.order.id}`);
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

  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Book Your Inspection</h1>
          <p className="text-muted-foreground">
            Fill out the details below and we&apos;ll take care of the rest.
          </p>
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
                Booking Type
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["self_arrange", "concierge"] as BookingType[]).map((bt) => (
                  <Card
                    key={bt}
                    className={`cursor-pointer transition-colors hover-elevate ${
                      bookingType === bt ? "border-primary" : ""
                    }`}
                    onClick={() => setBookingType(bt)}
                    data-testid={`card-booking-${bt}`}
                  >
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            bookingType === bt
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {bookingType === bt && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">
                            {bt === "self_arrange"
                              ? "Self-Arranged"
                              : "Concierge"}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {bt === "self_arrange"
                              ? "You already have an appointment with the seller. Save on the inspection cost."
                              : "We contact the seller and coordinate everything. Pay only when confirmed."}
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
                Inspection Package
              </Label>
              <div className="grid grid-cols-1 gap-3">
                {(["standard", "premium", "comprehensive"] as PackageType[]).map(
                  (p) => {
                    const info = PACKAGE_INFO[p];
                    const price = getPrice(p, bookingType);
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
                                  {formatCurrency(price.finalPrice)}
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
                  },
                )}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="year">Year *</Label>
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
                <Label htmlFor="make">Make *</Label>
                <Input
                  id="make"
                  placeholder="Toyota"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                  data-testid="input-make"
                />
              </div>
              <div>
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  placeholder="Camry"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  data-testid="input-model"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="location">Vehicle Location *</Label>
              <Input
                id="location"
                placeholder="City, State or full address"
                value={vehicleLocation}
                onChange={(e) => setVehicleLocation(e.target.value)}
                data-testid="input-location"
              />
            </div>
            <div>
              <Label htmlFor="description">Vehicle Description</Label>
              <Textarea
                id="description"
                placeholder="Any details about the vehicle (mileage, color, trim, etc.)"
                value={vehicleDescription}
                onChange={(e) => setVehicleDescription(e.target.value)}
                data-testid="input-description"
              />
            </div>
            <div>
              <Label htmlFor="listing">Listing URL</Label>
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
            {bookingType === "concierge" && (
              <>
                <div>
                  <Label htmlFor="sellerName">Seller Name</Label>
                  <Input
                    id="sellerName"
                    placeholder="John Doe"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    data-testid="input-seller-name"
                  />
                </div>
                <div>
                  <Label htmlFor="sellerPhone">Seller Phone</Label>
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
              <Label htmlFor="date">Preferred Inspection Date</Label>
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
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Package</span>
                <span className="font-medium">
                  {PACKAGE_INFO[pkg].name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Booking Type</span>
                <span>
                  {bookingType === "self_arrange"
                    ? "Self-Arranged"
                    : "Concierge"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vehicle</span>
                <span>
                  {vehicleYear} {vehicleMake} {vehicleModel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span>{vehicleLocation}</span>
              </div>
              {preferredDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preferred Date</span>
                  <span>{preferredDate}</span>
                </div>
              )}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Price</span>
                  <span>{formatCurrency(basePrice)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Self-Arranged Discount</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base mt-2">
                  <span>Total</span>
                  <span>{formatCurrency(finalPrice)}</span>
                </div>
              </div>
              {bookingType === "concierge" && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 mt-2">
                  With concierge booking, you won&apos;t be charged until the seller
                  confirms the appointment. We&apos;ll send you a payment link when
                  ready.
                </p>
              )}
              {bookingType === "self_arrange" && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 mt-2">
                  Payment will be processed immediately after order submission.
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
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              data-testid="button-next"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              data-testid="button-submit-order"
            >
              {loading ? "Submitting..." : "Submit Order"}
              <Shield className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
