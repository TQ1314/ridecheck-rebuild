"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState, useEffect, useRef } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, ArrowLeft, ArrowRight, Shield, Globe, MapPin, CheckCircle2, XCircle, Car, Info, HelpCircle, Monitor, Building2, Navigation, Link as LinkIcon, Upload, Loader2 } from "lucide-react";
import {
  PACKAGE_INFO,
  PRICING,
  formatCurrency,
  type PackageType,
  type BookingType,
} from "@/lib/utils/pricing";
import { detectSellerPlatform } from "@/lib/seller-contact/platforms";
import { type ClassificationResult, TIER_PRICES } from "@/lib/vehicleClassification";
import { isBuyerArrangedEnabled } from "@/lib/utils/featureFlags";
import { getServiceAreaFromZip } from "@/lib/geo/resolveCounty";
import { t, type Language } from "@/lib/i18n/translations";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { IntakeProposalCard } from "@/components/booking-intake/IntakeProposalCard";
import { resolveFacebookBookingType } from "@/lib/seller-contact/facebook-self-arrange";
import { clearVehicleAttempt } from "@/lib/booking-intake/resetVehicle";
import {
  emptyFacebookContactState,
  isFacebookMarketplaceListing,
  type FacebookContactEvent,
  type FacebookContactState,
} from "@/lib/seller-contact/facebook-marketplace";

type IntakeField = {
  value: string | number | null;
  source_type?: string;
  source_reference?: string;
  evidence?: string;
};

type IntakeProposal = Record<string, IntakeField>;
type ListingSource = "online_marketplace" | "dealership" | "roadside" | "auction" | "referral" | "offline" | "other";

const DISCOVERY_SOURCE_ALIASES: Record<string, string> = {
  online: "online_marketplace",
  marketplace: "online_marketplace",
  "online marketplace": "online_marketplace",
  dealer: "dealership",
  dealership: "dealership",
  "dealer lot": "dealership",
  roadside: "roadside",
  "for sale sign": "roadside",
  auction: "auction",
  "auction listing": "auction",
  referral: "referral",
  friend: "referral",
  offline: "offline",
  private: "offline",
  other: "other",
};

function normalizeDiscoverySource(value: unknown): ListingSource | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  const mapped = DISCOVERY_SOURCE_ALIASES[normalized] || normalized.replace(/\s+/g, "_");
  return ["online_marketplace", "dealership", "roadside", "auction", "referral", "offline", "other"].includes(mapped)
    ? mapped as ListingSource
    : null;
}

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

  type SellerType = "private_party" | "dealership" | "auction" | "other";
  const [sellerType, setSellerType] = useState<SellerType>("private_party");
  const [listingSource, setListingSource] = useState<ListingSource>("online_marketplace");
  const [platformSource, setPlatformSource] = useState<string>("");
  const [vehicleSeenLocation, setVehicleSeenLocation] = useState("");
  const [bookingType, setBookingType] = useState<BookingType>("concierge");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleTrim, setVehicleTrim] = useState("");
  const [vehicleFuelType, setVehicleFuelType] = useState<"" | "gasoline" | "diesel" | "hybrid" | "electric">("");
  const [vehicleCollector, setVehicleCollector] = useState(false);
  const [vehicleVin, setVehicleVin] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [vehicleMileage, setVehicleMileage] = useState("");
  const [vehiclePrice, setVehiclePrice] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [vehicleLocation, setVehicleLocation] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [sellerAvailableTime, setSellerAvailableTime] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmailInput, setBuyerEmailInput] = useState("");

  const [inspectionAddress, setInspectionAddress] = useState("");
  const [inspectionTimeWindow, setInspectionTimeWindow] = useState("");
  const [notesToInspector, setNotesToInspector] = useState("");
  const [facebookContact, setFacebookContact] = useState<FacebookContactState>(emptyFacebookContactState);
  const [facebookContactScope, setFacebookContactScope] = useState<string | null>(null);
  const facebookStorageHydrated = useRef<string | null>(null);
  const [facebookAuditIssue, setFacebookAuditIssue] = useState<{
    events: FacebookContactEvent[];
    onceKey?: string;
  } | null>(null);

  const [serviceZip, setServiceZip] = useState("");
  const [zipStatus, setZipStatus] = useState<"idle" | "valid" | "invalid">("idle");

  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [intakeUrl, setIntakeUrl] = useState("");
  const [intakeImageIds, setIntakeImageIds] = useState<string[]>([]);
  const [intakeImageNames, setIntakeImageNames] = useState<string[]>([]);
  const [intakeSessionCount, setIntakeSessionCount] = useState<number | null>(null);
  const [intakeSessionStatusError, setIntakeSessionStatusError] = useState(false);
  const [intakeProposal, setIntakeProposal] = useState<IntakeProposal | null>(null);
  const [intakeOriginalProposal, setIntakeOriginalProposal] = useState<IntakeProposal | null>(null);
  const [intakeProvenance, setIntakeProvenance] = useState<Record<string, unknown>>({});
  const [intakeWarning, setIntakeWarning] = useState("");
  const [intakeBusy, setIntakeBusy] = useState(false);
  const intakeFileRef = useRef<HTMLInputElement>(null);
  const classificationVersion = useRef(0);

  const [showWhyModal, setShowWhyModal] = useState(false);
  const imageCount = Math.max(intakeSessionCount ?? 0, intakeImageIds.length);
  const previousSessionImages = imageCount > 0 && intakeImageIds.length === 0;
  const hasVehicleAttempt = imageCount > 0 || intakeSessionStatusError || !!(
    intakeUrl || listingUrl || vehicleYear || vehicleMake || vehicleModel ||
    vehicleLocation || serviceZip || vehicleVin || sellerName || sellerPhone ||
    vehicleDescription || vehicleMileage || vehiclePrice || intakeProposal ||
    Object.keys(intakeProvenance).length
  );

  const isFacebookFlow = isFacebookMarketplaceListing(listingUrl, platformSource);
  const facebookStorageKey = isFacebookFlow
    ? `ridecheck-facebook-contact:${encodeURIComponent(listingUrl.trim() || platformSource)}`
    : null;
  const activeFacebookContact = facebookStorageKey && facebookContactScope === facebookStorageKey
    ? facebookContact
    : emptyFacebookContactState();
  const effectiveBookingType: BookingType = resolveFacebookBookingType(isFacebookFlow, bookingType);
  const isBuyerArranged = effectiveBookingType === "buyer_arranged";

  const pkg: PackageType = (classification?.packageTier || "standard") as PackageType;
  const isSelfArrange = effectiveBookingType === "self_arrange" || effectiveBookingType === "buyer_arranged";
  const basePrice = classification?.basePrice || TIER_PRICES.standard;
  const finalPrice = isSelfArrange ? Math.max(0, basePrice - 10) : basePrice;

  useEffect(() => {
    if (facebookStorageHydrated.current === facebookStorageKey) return;
    const previousKey = facebookStorageHydrated.current;
    facebookStorageHydrated.current = facebookStorageKey;
    setFacebookAuditIssue(null);
    // Preserve seller details just confirmed by the existing listing-intake
    // path on first entry. A different Marketplace scope must not reuse them.
    if (previousKey) {
      setSellerName("");
      setSellerPhone("");
      setSellerEmail("");
      setInspectionAddress("");
      setPreferredDate("");
      setSellerAvailableTime("");
      setInspectionTimeWindow("");
      setNotesToInspector("");
    }
    if (!facebookStorageKey) {
      setFacebookContact(emptyFacebookContactState());
      setFacebookContactScope(null);
      return;
    }
    try {
      const raw = sessionStorage.getItem(facebookStorageKey);
      const saved = raw ? JSON.parse(raw) : null;
      const savedContact = saved?.contact;
      setFacebookContact(
        savedContact && typeof savedContact.seller_consent_reported === "boolean"
          ? {
              seller_message_copied: savedContact.seller_message_copied === true,
              facebook_listing_opened: savedContact.facebook_listing_opened === true,
              seller_consent_reported: savedContact.seller_consent_reported === true,
              seller_consent_reported_at: typeof savedContact.seller_consent_reported_at === "string"
                ? savedContact.seller_consent_reported_at
                : null,
            }
          : emptyFacebookContactState(),
      );
      if (saved) {
        setSellerName(typeof saved.sellerName === "string" ? saved.sellerName : "");
        setSellerPhone(typeof saved.sellerPhone === "string" ? saved.sellerPhone : "");
        setSellerEmail(typeof saved.sellerEmail === "string" ? saved.sellerEmail : "");
        setInspectionAddress(typeof saved.inspectionAddress === "string" ? saved.inspectionAddress : "");
        setPreferredDate(typeof saved.preferredDate === "string" ? saved.preferredDate : "");
        setSellerAvailableTime(typeof saved.sellerAvailableTime === "string" ? saved.sellerAvailableTime : "");
      }
      setFacebookContactScope(facebookStorageKey);
    } catch {
      setFacebookContact(emptyFacebookContactState());
      setFacebookContactScope(facebookStorageKey);
    }
  }, [facebookStorageKey]);

  useEffect(() => {
    if (!facebookStorageKey || facebookContactScope !== facebookStorageKey || facebookStorageHydrated.current !== facebookStorageKey) return;
    try {
      sessionStorage.setItem(facebookStorageKey, JSON.stringify({
        contact: facebookContact,
        sellerName,
        sellerPhone,
        sellerEmail,
        inspectionAddress,
        preferredDate,
        sellerAvailableTime,
      }));
    } catch {
      // Booking remains usable if this browser does not allow session storage.
    }
  }, [facebookStorageKey, facebookContactScope, facebookContact, sellerName, sellerPhone, sellerEmail, inspectionAddress, preferredDate, sellerAvailableTime]);

  useEffect(() => {
    let active = true;
    fetch("/api/booking-intake/session")
      .then(async (response) => {
        if (!response.ok) throw new Error("Intake status unavailable");
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setIntakeSessionCount(data.imageCount);
        setIntakeSessionStatusError(false);
      })
      .catch(() => {
        if (active) setIntakeSessionStatusError(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!vehicleMake || !vehicleModel || !vehicleYear) {
      setClassification(null);
      return;
    }
    let cancelled = false;
    const version = classificationVersion.current;
    const timer = setTimeout(() => {
      fetch("/api/classify-vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          make: vehicleMake,
          model: [vehicleModel, vehicleTrim].filter(Boolean).join(" "),
          fuelType: vehicleFuelType || null,
          collector: vehicleCollector,
          year: parseInt(vehicleYear) || new Date().getFullYear(),
          mileage: vehicleMileage ? parseInt(vehicleMileage) : null,
          askingPrice: vehiclePrice ? parseFloat(vehiclePrice) : null,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled || version !== classificationVersion.current) return;
          setClassification({
            packageTier: data.tier || "standard",
            basePrice: data.price || TIER_PRICES.standard,
            requiresUpgrade: data.requiresUpgrade ?? false,
            modifier: null,
            classificationReason: "",
          });
        })
        .catch(() => {
          if (!cancelled && version === classificationVersion.current) setClassification(null);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [vehicleMake, vehicleModel, vehicleTrim, vehicleYear, vehicleMileage, vehiclePrice, vehicleFuelType, vehicleCollector]);

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

  const handleIntakeUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, 5 - imageCount);
    if (!selected.length) {
      setIntakeWarning("You can upload up to 5 images.");
      return;
    }
    const form = new FormData();
    selected.forEach((file) => form.append("files", file));
    setIntakeBusy(true);
    setIntakeWarning("");
    try {
      const response = await fetch("/api/booking-intake/upload", { method: "POST", body: form });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Upload unavailable");
      }
      const data = await response.json();
      const images = Array.isArray(data.images) ? data.images : [];
      setIntakeImageIds((current) => [...current, ...images.map((image: { id: string }) => image.id)]);
      setIntakeImageNames((current) => [...current, ...images.map((image: { name: string }) => image.name)]);
      setIntakeSessionCount((current) => Math.max(current ?? 0, intakeImageIds.length) + images.length);
    } catch (error) {
      setIntakeWarning(error instanceof Error && error.message === "This intake has reached its image limit."
        ? "This intake has reached its image limit. Start over with another vehicle to upload new screenshots."
        : "We couldn't upload those images. You can continue with the listing link or manual entry.");
    } finally {
      setIntakeBusy(false);
      if (intakeFileRef.current) intakeFileRef.current.value = "";
    }
  };

  const handleVehicleReset = async () => {
    setIntakeBusy(true);
    try {
      const response = await fetch("/api/booking-intake/session", { method: "POST" });
      if (!response.ok) throw new Error("Unable to start a new intake");
      classificationVersion.current += 1;
      clearVehicleAttempt({
        setSellerType, setListingSource, setBookingType, setPlatformSource,
        setVehicleSeenLocation, setVehicleYear, setVehicleMake, setVehicleModel,
        setVehicleTrim, setVehicleVin, setVehicleDescription, setVehicleMileage,
        setVehiclePrice, setListingUrl, setVehicleLocation, setSellerName,
        setSellerPhone, setPreferredDate, setInspectionAddress, setInspectionTimeWindow,
        setNotesToInspector, setServiceZip, setZipStatus, setClassification,
        setIntakeUrl, setIntakeImageIds, setIntakeImageNames, setIntakeProposal,
        setIntakeOriginalProposal, setIntakeProvenance, setIntakeWarning,
        setShowWhyModal, setStep,
      });
      setVehicleFuelType("");
      setVehicleCollector(false);
      setSellerEmail("");
      setSellerAvailableTime("");
      setFacebookContact(emptyFacebookContactState());
      setFacebookContactScope(null);
      setFacebookAuditIssue(null);
      setIntakeSessionCount(0);
      setIntakeSessionStatusError(false);
      if (intakeFileRef.current) intakeFileRef.current.value = "";
    } catch {
      setIntakeWarning("We couldn't start a new vehicle intake. Please try again; your current details are unchanged.");
    } finally {
      setIntakeBusy(false);
    }
  };

  const handleIntakeExtract = async () => {
    if (!intakeUrl.trim() && !intakeImageIds.length) {
      setIntakeWarning("Add a listing link or at least one image first.");
      return;
    }
    setIntakeBusy(true);
    setIntakeWarning("");
    setIntakeProposal(null);
    try {
      const response = await fetch("/api/booking-intake/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(intakeUrl.trim() ? { url: intakeUrl.trim() } : {}),
          ...(intakeImageIds.length ? { imageIds: intakeImageIds } : {}),
        }),
      });
      if (!response.ok) throw new Error("Extraction unavailable");
      const data = await response.json();
      const fields = data?.fields && typeof data.fields === "object" ? data.fields : {};
      setIntakeProposal(fields as IntakeProposal);
      setIntakeOriginalProposal(fields as IntakeProposal);
      setIntakeWarning(data.warning || (!Object.keys(fields).length
        ? "We couldn't read enough details yet. Continue with manual entry."
        : ""));
    } catch {
      setIntakeWarning("We couldn't read all the details from this listing. Upload a screenshot or enter the missing information.");
    } finally {
      setIntakeBusy(false);
    }
  };

  const confirmIntakeProposal = () => {
    if (!intakeProposal) return;
    const value = (key: string) => intakeProposal[key]?.value;
    if (value("year") != null) setVehicleYear(String(value("year")));
    if (value("make") != null) setVehicleMake(String(value("make")));
    if (value("model") != null) setVehicleModel(String(value("model")));
    if (value("trim") != null) setVehicleTrim(String(value("trim")));
    if (value("vin") != null) setVehicleVin(String(value("vin")));
    if (value("mileage") != null) setVehicleMileage(String(value("mileage")));
    if (value("asking_price") != null) setVehiclePrice(String(value("asking_price")));
    if (value("location_text") != null) setVehicleLocation(String(value("location_text")));
    if (value("service_zip") != null) handleZipChange(String(value("service_zip")));
    if (value("seller_name") != null) setSellerName(String(value("seller_name")));
    if (value("seller_phone") != null) setSellerPhone(String(value("seller_phone")));
    if (value("platform_source") != null) setPlatformSource(String(value("platform_source")));
    if (value("discovery_source") != null) {
      const normalizedSource = normalizeDiscoverySource(value("discovery_source"));
      if (normalizedSource) setListingSource(normalizedSource);
    }
    setListingUrl((current) => current || intakeUrl.trim());
    setIntakeProvenance(compactProvenance);
    setIntakeProposal(null);
  };

  const compactProvenance = Object.fromEntries(
    Object.entries(intakeOriginalProposal || {}).map(([key, field]) => [
      key,
      {
        proposal: field.value,
        // Keep the source bounded and self-contained for the existing order
        // create contract; do not persist unbounded URLs or model output.
        source: [field.source_type || "unknown", field.source_reference || ""].join(":").slice(0, 120),
        ...(field.evidence ? { evidence: field.evidence.slice(0, 500) } : {}),
        buyer_final: null,
      },
    ]),
  );

  const finalIntakeValues: Record<string, string | null> = {
    year: vehicleYear || null,
    make: vehicleMake || null,
    model: vehicleModel || null,
    trim: vehicleTrim || null,
    mileage: vehicleMileage || null,
    asking_price: vehiclePrice || null,
    location_text: vehicleLocation || null,
    service_zip: serviceZip || null,
    vin: vehicleVin || null,
    seller_name: sellerName || null,
    seller_phone: sellerPhone || null,
    platform_source: platformSource || null,
  };

  const updateIntakeProposalField = (key: string, nextValue: string) => {
    setIntakeProposal((current) => current
      ? { ...current, [key]: { ...current[key], value: nextValue || null } }
      : current);
  };

  const canProceed = () => {
    if (step === 0)
      return (
        !!vehicleYear && !!vehicleMake && !!vehicleModel && !!vehicleLocation &&
        zipStatus === "valid" && !!bookingType
      );
    if (step === 1) {
      if (!buyerPhone || buyerPhone.length < 7) return false;
      if (!buyerEmailInput || !buyerEmailInput.includes("@")) return false;
      if (isFacebookFlow) {
        if (sellerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sellerEmail)) return false;
        return !!preferredDate.trim();
      }
      if (isBuyerArranged) {
        return !!inspectionAddress && !!inspectionTimeWindow && !!sellerPhone;
      }
      return true;
    }
    return true;
  };

  const handleFacebookAudit = async (events: FacebookContactEvent[], onceKey?: string) => {
    if (!isFacebookFlow || !facebookStorageKey) return false;
    const marker = onceKey ? `${facebookStorageKey}:audit:${onceKey}` : null;
    if (marker) {
      try {
        if (sessionStorage.getItem(marker) === "done") return true;
      } catch {
        // Continue with the server audit if this browser blocks session storage.
      }
    }
    try {
      const response = await fetch("/api/booking-intake/seller-contact-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_url: listingUrl.trim() || null,
          platform_source: "facebook_marketplace",
          events,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) throw new Error("Seller-contact activity record was not confirmed");
      try {
        if (marker) sessionStorage.setItem(marker, "done");
        if (onceKey === "initial") sessionStorage.setItem(`${facebookStorageKey}:initial-audit`, "done");
      } catch {
        // The successful API response is authoritative even if tab storage is blocked.
      }
      setFacebookAuditIssue((current) =>
        current && current.onceKey === onceKey && current.events.join("|") === events.join("|") ? null : current,
      );
      return true;
    } catch {
      setFacebookAuditIssue({ events, onceKey });
      return false;
    }
  };

  const hasFacebookSellerDetails = Boolean(
    sellerName.trim() || sellerPhone.trim() || sellerEmail.trim() ||
    inspectionAddress.trim() || preferredDate || sellerAvailableTime,
  );

  const handleNext = async () => {
    if (!canProceed()) return;
    if (step === 1 && isFacebookFlow && hasFacebookSellerDetails) {
      await handleFacebookAudit(["seller_contact_details_provided"], "seller-details");
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (isFacebookFlow && !preferredDate.trim()) return;
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const idempotencyKey = crypto.randomUUID();

      const listingPlatform = listingUrl
        ? detectSellerPlatform(listingUrl)
        : null;

      const body: Record<string, any> = {
        vehicle_year: parseInt(vehicleYear),
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_fuel_type: vehicleFuelType || null,
        vehicle_collector: vehicleCollector,
        vehicle_trim: vehicleTrim || null,
        vin: vehicleVin || null,
        vehicle_description: vehicleDescription || null,
        listing_url: listingUrl || null,
        vehicle_location: vehicleLocation,
        seller_name: sellerName || null,
        seller_phone: sellerPhone || null,
        buyer_phone: buyerPhone,
        buyer_email_input: buyerEmailInput || null,
        booking_type: isBuyerArranged ? "self_arrange" : effectiveBookingType,
        preferred_date: preferredDate || null,
        booking_method: isBuyerArranged ? "buyer_arranged" : "concierge",
        preferred_language: lang,
        listing_platform: listingPlatform,
        listing_source: listingSource,
        platform_source: isFacebookFlow ? "facebook_marketplace" : platformSource || null,
        seller_type: sellerType,
        vehicle_seen_location: vehicleSeenLocation || null,
        service_zip: serviceZip,
        vehicle_mileage: vehicleMileage ? parseInt(vehicleMileage) : null,
        vehicle_price: vehiclePrice ? parseFloat(vehiclePrice) : null,
        ...(Object.keys(intakeProvenance).length
          ? {
              intake_provenance: Object.fromEntries(Object.entries(intakeProvenance).map(([key, field]) => [
                key,
                { ...(field as Record<string, unknown>), buyer_final: finalIntakeValues[key] ?? null },
              ])),
            }
          : {}),
      };

      if (isBuyerArranged) {
        body.inspection_address = inspectionAddress;
        body.inspection_time_window = inspectionTimeWindow;
        body.notes_to_inspector = notesToInspector || null;
      }

      if (isFacebookFlow) {
        body.booking_type = "self_arrange";
        body.booking_method = "self_arrange";
        body.facebook_contact = activeFacebookContact;
        body.seller_email = sellerEmail.trim() || null;
        // preferred_date is a request, not confirmed seller availability.
        body.seller_available_time = sellerAvailableTime || null;
        if (inspectionAddress.trim()) body.inspection_address = inspectionAddress.trim();
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

      if (isFacebookFlow && typeof data.facebook_audit_warning === "string" && data.facebook_audit_warning.trim()) {
        toast({
          title: "Activity record warning",
          description: data.facebook_audit_warning,
        });
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      const trackParam = data.track_url ? `&track=${encodeURIComponent(data.track_url)}` : "";
      const confirmUrl = `/order/confirmation?order_id=${data.order.id}&lang=${lang}&method=${isBuyerArranged ? "buyer_arranged" : effectiveBookingType}${trackParam}`;
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
                Now Serving: Lake County &amp; McHenry County, IL
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
                Enter your ZIP below to confirm service availability in your area.
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
            <Card className="border-primary/30 bg-primary/[0.03]" data-testid="card-universal-intake">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Found a vehicle you want inspected?</CardTitle>
                <p className="text-sm text-muted-foreground">Send us what you have. We&apos;ll suggest details for you to confirm, or you can enter everything manually below.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={intakeUrl}
                    onChange={(event) => { setIntakeUrl(event.target.value); setListingUrl(event.target.value); }}
                    placeholder="Paste a listing link (Facebook, OfferUp, dealer site, and more)"
                    aria-label="Listing link"
                    data-testid="input-intake-url"
                  />
                  <Button type="button" variant="outline" onClick={handleIntakeExtract} disabled={intakeBusy || !intakeUrl.trim()} data-testid="button-intake-link">
                    <LinkIcon className="mr-2 h-4 w-4" /> Use link
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={intakeFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(event) => handleIntakeUpload(event.target.files)}
                    data-testid="input-intake-images"
                  />
                  <Button type="button" variant="outline" onClick={() => intakeFileRef.current?.click()} disabled={intakeBusy || intakeSessionCount === null || intakeSessionStatusError || previousSessionImages || imageCount >= 5} data-testid="button-intake-upload">
                    <Upload className="mr-2 h-4 w-4" /> Upload screenshots or photos · Up to 5
                  </Button>
                  <span className="text-xs text-muted-foreground" data-testid="text-intake-image-count">
                    {imageCount} of 5 images added{imageCount >= 5 ? " · Maximum reached" : ""}
                  </span>
                  {intakeImageIds.length > 0 && (
                    <Button type="button" onClick={handleIntakeExtract} disabled={intakeBusy} data-testid="button-intake-images">
                      {intakeBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Read what&apos;s visible
                    </Button>
                  )}
                </div>
                {previousSessionImages && (
                  <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
                    Previous screenshots are still associated with this intake. Start over with another vehicle to upload new screenshots.
                  </p>
                )}
                {intakeSessionStatusError && (
                  <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
                    We couldn&apos;t check previous uploads. Start over with another vehicle before uploading new screenshots.
                  </p>
                )}
                {hasVehicleAttempt && (
                  <Button type="button" variant="outline" onClick={handleVehicleReset} disabled={intakeBusy || loading || (intakeSessionCount === null && !intakeSessionStatusError)} data-testid="button-reset-vehicle">
                    Start over with another vehicle
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Manual entry is always available. Extraction is optional and never required to book.</p>
                {intakeWarning && <p className="text-sm text-amber-700 dark:text-amber-300" role="status">{intakeWarning}</p>}
                {intakeProposal && (
                  <IntakeProposalCard
                    proposal={intakeProposal}
                    onChange={updateIntakeProposalField}
                    onConfirm={confirmIntakeProposal}
                    onManual={() => setIntakeProposal(null)}
                  />
                )}
              </CardContent>
            </Card>
            {/* ── Who is selling? ── */}
            <div>
              <Label className="text-base font-semibold mb-1 block">Who is selling this vehicle? *</Label>
              <p className="text-sm text-muted-foreground mb-3">This helps us tailor the inspection workflow.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { value: "private_party" as SellerType, icon: "👤", label: "Private Seller" },
                  { value: "dealership"   as SellerType, icon: "🏢", label: "Dealership" },
                  { value: "auction"      as SellerType, icon: "🔨", label: "Auction" },
                  { value: "other"        as SellerType, icon: "❓", label: "Other" },
                ]).map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setSellerType(st.value)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                      sellerType === st.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                    data-testid={`card-seller-type-${st.value}`}
                  >
                    <span className="text-xl">{st.icon}</span>
                    <span className="text-xs">{st.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-semibold mb-1 block">{t("booking.source.title", lang)}</Label>
              <p className="text-sm text-muted-foreground mb-3">{t("booking.source.subtitle", lang)}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  {
                    value: "online_marketplace" as ListingSource,
                    icon: <Monitor className="h-5 w-5 text-blue-500" />,
                    label: t("booking.source.online", lang),
                    desc: t("booking.source.online.desc", lang),
                  },
                  {
                    value: "dealership" as ListingSource,
                    icon: <Building2 className="h-5 w-5 text-emerald-500" />,
                    label: t("booking.source.dealership", lang),
                    desc: t("booking.source.dealership.desc", lang),
                  },
                  {
                    value: "roadside" as ListingSource,
                    icon: <Navigation className="h-5 w-5 text-amber-500" />,
                    label: t("booking.source.roadside", lang),
                    desc: t("booking.source.roadside.desc", lang),
                  },
                  {
                    value: "auction" as ListingSource,
                    icon: <span className="text-lg">🔨</span>,
                    label: "Auction",
                    desc: "Auction listing or sale",
                  },
                  {
                    value: "referral" as ListingSource,
                    icon: <span className="text-lg">🤝</span>,
                    label: "Referral",
                    desc: "Friend, family, or referral",
                  },
                  {
                    value: "offline" as ListingSource,
                    icon: <span className="text-lg">📍</span>,
                    label: "Private / offline",
                    desc: "No online listing",
                  },
                  {
                    value: "other" as ListingSource,
                    icon: <span className="text-lg">❓</span>,
                    label: "Other",
                    desc: "Somewhere else",
                  },
                ] as { value: ListingSource; icon: React.ReactNode; label: string; desc: string }[]).map((src) => (
                  <Card
                    key={src.value}
                    className={`cursor-pointer transition-colors hover-elevate ${
                      listingSource === src.value ? "border-primary" : ""
                    }`}
                    onClick={() => { setListingSource(src.value); setPlatformSource(""); }}
                    data-testid={`card-source-${src.value}`}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            listingSource === src.value
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {listingSource === src.value && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {src.icon}
                            <h3 className="font-semibold text-sm">{src.label}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground">{src.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {listingSource && (() => {
                const opts: { value: string; label: string }[] =
                      listingSource === "online_marketplace"
                    ? [
                        { value: "facebook_marketplace", label: "Facebook Marketplace" },
                        { value: "craigslist", label: "Craigslist" },
                        { value: "offerup", label: "OfferUp" },
                        { value: "cargurus", label: "CarGurus" },
                        { value: "autotrader", label: "Autotrader" },
                        { value: "cars_com", label: "Cars.com" },
                        { value: "other", label: t("booking.platform.other", lang) },
                      ]
                    : listingSource === "dealership"
                      ? [
                          { value: "dealership_website", label: t("booking.platform.dealershipWebsite", lang) },
                          { value: "cargurus", label: "CarGurus" },
                          { value: "autotrader", label: "Autotrader" },
                          { value: "cars_com", label: "Cars.com" },
                          { value: "walked_in", label: t("booking.platform.walkedIn", lang) },
                          { value: "other", label: t("booking.platform.otherShort", lang) },
                        ]
                    : listingSource === "roadside"
                      ? [
                          { value: "roadside_sign", label: t("booking.platform.roadsideSign", lang) },
                          { value: "other", label: t("booking.platform.otherShort", lang) },
                        ]
                      : [
                          { value: "other", label: "Other / not listed" },
                        ];

                return (
                  <div className="mt-3">
                    <Label htmlFor="platformSource" className="text-sm font-medium">
                      {listingSource === "online_marketplace"
                        ? t("booking.platform.online.label", lang)
                        : listingSource === "dealership"
                          ? t("booking.platform.dealership.label", lang)
                          : listingSource === "roadside"
                            ? t("booking.platform.roadside.label", lang)
                            : "Where did you find it?"}
                    </Label>
                    <Select
                      value={platformSource}
                      onValueChange={setPlatformSource}
                    >
                      <SelectTrigger
                        id="platformSource"
                        className="mt-1.5"
                        data-testid="select-platform-source"
                      >
                        <SelectValue placeholder={t("booking.platform.placeholder", lang)} />
                      </SelectTrigger>
                      <SelectContent>
                        {opts.map((o) => (
                          <SelectItem key={o.value} value={o.value} data-testid={`option-platform-${o.value}`}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}
            </div>

            <div>
              <Label className="text-base font-semibold mb-3 block">
                {t("booking.bookingType", lang)}
              </Label>
              {isFacebookFlow ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm dark:bg-blue-950/30" data-testid="facebook-self-arrange">
                  <p className="font-semibold">Facebook Marketplace — Self-Arrange</p>
                  <p>Concierge is unavailable for Facebook Marketplace. After checkout, use the seller message in your confirmation email or text to arrange the appointment through Messenger.</p>
                  <p>Payment and a requested date do not confirm an appointment. No dispatch until the seller confirms.</p>
                </div>
              ) : (
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
              )}
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
                  <Label htmlFor="trim">Trim (if known)</Label>
                  <Input id="trim" placeholder="LE, XLE, Sport..." value={vehicleTrim} onChange={(e) => setVehicleTrim(e.target.value)} data-testid="input-trim" />
                </div>
                <div>
                  <Label htmlFor="vin">VIN (if known)</Label>
                  <Input id="vin" placeholder="17-character VIN" maxLength={17} value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value.toUpperCase())} data-testid="input-vin" />
                </div>
              </div>
              <div>
                <Label htmlFor="fuelType">{lang === "es" ? "Combustible (si lo sabe)" : "Fuel type (if known)"}</Label>
                <select
                  id="fuelType"
                  value={vehicleFuelType}
                  onChange={(e) => setVehicleFuelType(e.target.value as typeof vehicleFuelType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="select-fuel-type"
                >
                  <option value="">{lang === "es" ? "No estoy seguro" : "Not sure"}</option>
                  <option value="gasoline">{lang === "es" ? "Gasolina" : "Gasoline"}</option>
                  <option value="diesel">Diesel</option>
                  <option value="hybrid">{lang === "es" ? "Híbrido" : "Hybrid"}</option>
                  <option value="electric">{lang === "es" ? "Eléctrico" : "Electric"}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={vehicleCollector} onChange={(e) => setVehicleCollector(e.target.checked)} data-testid="checkbox-collector" />
                {lang === "es" ? "Este es un vehículo de colección" : "This is a collector vehicle"}
              </label>
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
                  <p className="text-xs text-muted-foreground mt-1">{t("booking.askingPrice.hint", lang)}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="location">
                  {listingSource === "roadside"
                    ? t("booking.location.roadside.label", lang)
                    : listingSource === "dealership"
                      ? t("booking.location.dealership.label", lang)
                      : t("booking.vehicleLocation", lang) + " *"}
                </Label>
                <Input
                  id="location"
                  placeholder={
                    listingSource === "roadside"
                      ? t("booking.location.roadside.placeholder", lang)
                      : listingSource === "dealership"
                        ? t("booking.location.dealership.placeholder", lang)
                        : t("booking.location.default.placeholder", lang)
                  }
                  value={vehicleLocation}
                  onChange={(e) => setVehicleLocation(e.target.value)}
                  data-testid="input-location"
                />
                {listingSource === "roadside" && (
                  <p className="text-xs text-muted-foreground mt-1">{t("booking.location.roadside.hint", lang)}</p>
                )}
              </div>
              {listingSource === "roadside" && (
                <div>
                  <Label htmlFor="vehicleSeenLocation">
                    {t("booking.seenLocation.label", lang)}
                  </Label>
                  <Input
                    id="vehicleSeenLocation"
                    placeholder={t("booking.seenLocation.placeholder", lang)}
                    value={vehicleSeenLocation}
                    onChange={(e) => setVehicleSeenLocation(e.target.value)}
                    data-testid="input-vehicle-seen-location"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("booking.seenLocation.hint", lang)}
                  </p>
                </div>
              )}
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
                    Available in your area
                  </p>
                )}
                {zipStatus === "invalid" && (
                  <div className="mt-1.5 space-y-2" data-testid="text-zip-invalid">
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <XCircle className="h-4 w-4" />
                      RideCheck does not currently service this vehicle location. We currently serve Lake and McHenry Counties, IL.
                    </p>
                    <Button type="button" variant="outline" onClick={handleVehicleReset} disabled={intakeBusy || loading || (intakeSessionCount === null && !intakeSessionStatusError)} data-testid="button-reset-vehicle-service-area">
                      Start over with another vehicle
                    </Button>
                  </div>
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
              {["online_marketplace", "dealership", "auction", "other"].includes(listingSource) && (
                <div>
                  <Label htmlFor="listing">
                    {t("booking.listingUrl", lang)}
                  </Label>
                  <Input
                    id="listing"
                    type="url"
                    placeholder="https://..."
                    value={listingUrl}
                    onChange={(e) => { setListingUrl(e.target.value); setIntakeUrl(e.target.value); }}
                    data-testid="input-listing-url"
                  />
                </div>
              )}
            </div>

            {classification && (
              <>
                <Card className="border-primary/50 bg-primary/5" data-testid="card-vehicle-package">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <Car className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold">
                                Vehicle Required Package: {PACKAGE_INFO[classification.packageTier as PackageType]?.name || classification.packageTier}
                              </p>
                              {classification.requiresUpgrade && (
                                <button
                                  type="button"
                                  onClick={() => setShowWhyModal(true)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  data-testid="button-why-package"
                                  aria-label="Why is this package required?"
                                >
                                  <HelpCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {PACKAGE_INFO[classification.packageTier as PackageType]?.tagline}
                            </p>
                            {classification.requiresUpgrade && (
                              <button
                                type="button"
                                onClick={() => setShowWhyModal(true)}
                                className="text-xs text-primary underline underline-offset-2 mt-1 hover:text-primary/80 transition-colors"
                                data-testid="link-why-package"
                              >
                                Why is this package required?
                              </button>
                            )}
                          </div>
                          <div className="text-right">
                            {isSelfArrange && (
                              <p className="text-xs line-through text-muted-foreground" data-testid="text-base-price-strikethrough">
                                {formatCurrency(basePrice)}
                              </p>
                            )}
                            <span className="text-lg font-bold" data-testid="text-determined-price">
                              {formatCurrency(finalPrice)}
                            </span>
                            {isSelfArrange && (
                              <p className="text-xs text-green-600 dark:text-green-400 font-medium">$10 self-arrange discount</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {!vehicleFuelType && (
                      <div className="flex items-start gap-2 mt-3 pt-3 border-t border-primary/20">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          If known, add fuel type above for the most accurate package match.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Dialog open={showWhyModal} onOpenChange={setShowWhyModal}>
                  <DialogContent className="max-w-sm" data-testid="dialog-why-package">
                    <DialogHeader>
                      <DialogTitle>
                        Why {PACKAGE_INFO[classification.packageTier as PackageType]?.name} is required
                      </DialogTitle>
                      <DialogDescription asChild>
                        <div className="space-y-3 text-sm text-foreground mt-2">
                          {classification.packageTier === "plus" && (
                            <>
                              <p className="text-muted-foreground">
                                This vehicle falls into a higher-complexity category based on make, model, drivetrain, or diagnostic risk. To reduce the chance of missed issues, RideCheck requires the Plus inspection level for this type of vehicle.
                              </p>
                              <ul className="space-y-1 text-muted-foreground">
                                {[
                                  "European luxury vehicles (BMW, Mercedes, Audi, etc.)",
                                  "EVs and hybrids",
                                  "Higher diagnostic complexity",
                                  "Vehicles that benefit from deeper inspection coverage",
                                ].map((item) => (
                                  <li key={item} className="flex items-start gap-2">
                                    <span className="text-primary mt-0.5">•</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                              <p className="text-xs text-muted-foreground border-t pt-2">
                                Standard is not available for this vehicle category.
                              </p>
                            </>
                          )}
                          {classification.packageTier === "exotic" && (
                            <>
                              <p className="text-muted-foreground">
                                This vehicle is an exotic, performance, or collector model. RideCheck requires the Exotic inspection level for this vehicle category; asking price alone does not determine this tier.
                              </p>
                              <p className="text-xs text-muted-foreground border-t pt-2">
                                Standard and Plus are not available for this vehicle category.
                              </p>
                            </>
                          )}
                        </div>
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </>
            )}

          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {isFacebookFlow && facebookAuditIssue && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
                <p>We couldn’t save this activity record. Your reported choices remain in this order; retry the activity record when you’re ready.</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void handleFacebookAudit(facebookAuditIssue.events, facebookAuditIssue.onceKey)}>Retry activity record</Button>
              </div>
            )}
            {isFacebookFlow && (
              <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">What the seller has shared so far</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    You arrange the appointment with the seller through Messenger. Seller contact details are optional; a preferred inspection date is required. These details do not confirm an appointment.
                  </p>
                </div>
                <div>
                  <Label htmlFor="fbSellerName">{t("booking.sellerName", lang)}</Label>
                  <Input id="fbSellerName" value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="Seller name, if shared" data-testid="input-seller-name" />
                </div>
                <div>
                  <Label htmlFor="fbSellerPhone">{t("booking.sellerPhone", lang)}</Label>
                  <Input id="fbSellerPhone" type="tel" value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} placeholder="Seller phone, if shared" data-testid="input-seller-phone" />
                </div>
                <div>
                  <Label htmlFor="fbSellerEmail">Seller email</Label>
                  <Input id="fbSellerEmail" type="email" value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} placeholder="Seller email, if shared" data-testid="input-seller-email" />
                </div>
                <div>
                  <Label htmlFor="inspectionAddress">Inspection address or location</Label>
                  <Input id="inspectionAddress" value={inspectionAddress} onChange={(e) => setInspectionAddress(e.target.value)} placeholder="Where the vehicle can be inspected, if known" data-testid="input-inspection-address" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="date">Preferred inspection date *</Label>
                    <Input id="date" type="date" required value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} data-testid="input-preferred-date" />
                  </div>
                  <div>
                    <Label htmlFor="sellerAvailableTime">Seller availability time</Label>
                    <Input id="sellerAvailableTime" type="time" value={sellerAvailableTime} onChange={(e) => setSellerAvailableTime(e.target.value)} data-testid="input-seller-available-time" />
                  </div>
                </div>
              </div>
            )}
            {!isFacebookFlow && isBuyerArranged && (
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
            {!isFacebookFlow && bookingType === "concierge" && (
              <>
                <div>
                  <Label htmlFor="sellerName">
                    {listingSource === "dealership"
                      ? t("booking.dealershipName", lang)
                      : t("booking.sellerName", lang)}
                  </Label>
                  <Input
                    id="sellerName"
                    placeholder={
                      listingSource === "dealership"
                        ? t("booking.dealershipName.placeholder", lang)
                        : "John Doe"
                    }
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    data-testid="input-seller-name"
                  />
                </div>
                <div>
                  <Label htmlFor="sellerPhone">
                    {listingSource === "dealership"
                      ? t("booking.dealershipPhone", lang)
                      : listingSource === "roadside"
                        ? t("booking.roadsidePhone", lang)
                        : t("booking.sellerPhone", lang)}
                  </Label>
                  <Input
                    id="sellerPhone"
                    placeholder={
                      listingSource === "dealership"
                        ? t("booking.dealershipPhone.placeholder", lang)
                        : "(555) 123-4567"
                    }
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    data-testid="input-seller-phone"
                  />
                  {listingSource === "dealership" && (
                    <p className="text-xs text-muted-foreground mt-1">{t("booking.dealershipPhone.hint", lang)}</p>
                  )}
                  {listingSource === "roadside" && (
                    <p className="text-xs text-muted-foreground mt-1">{t("booking.roadsidePhone.hint", lang)}</p>
                  )}
                </div>
              </>
            )}
            <div className="pt-4 border-t space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Your contact info</p>
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
                <Label htmlFor="buyerEmail">Your Email *</Label>
                <Input
                  id="buyerEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={buyerEmailInput}
                  onChange={(e) => setBuyerEmailInput(e.target.value)}
                  data-testid="input-buyer-email"
                />
                <p className="text-xs text-muted-foreground mt-1">We&apos;ll send your order confirmation and seller contact script here</p>
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
          <>
          {isFacebookFlow && facebookAuditIssue && (
            <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
              <p>We couldn’t save this activity record. Your reported choices remain in this order; retry the activity record when you’re ready.</p>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void handleFacebookAudit(facebookAuditIssue.events, facebookAuditIssue.onceKey)}>Retry activity record</Button>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("booking.orderSummary", lang)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("booking.review.package", lang)}
                </span>
                <span className="font-medium">
                  {PACKAGE_INFO[pkg]?.name || pkg}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("booking.review.vehicleFound", lang)}</span>
                <span>
                  {listingSource === "dealership"
                    ? t("booking.review.vehicleFound.dealership", lang)
                    : listingSource === "roadside"
                      ? t("booking.review.vehicleFound.roadside", lang)
                      : listingSource === "auction"
                        ? "Auction"
                        : listingSource === "referral"
                          ? "Referral"
                          : listingSource === "offline"
                            ? "Private / offline"
                            : t("booking.review.vehicleFound.online", lang)}
                </span>
              </div>
              {platformSource && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("booking.review.platformSource", lang)}</span>
                  <span className="capitalize">{platformSource.replace(/_/g, " ")}</span>
                </div>
              )}
              {vehicleSeenLocation && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("booking.review.carLocation", lang)}</span>
                  <span className="text-right max-w-[55%]">{vehicleSeenLocation}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("booking.bookingType", lang)}
                </span>
                <span>
                  {isBuyerArranged
                    ? t("booking.buyerArranged", lang)
                    : effectiveBookingType === "self_arrange"
                      ? t("booking.selfArrange", lang)
                      : t("booking.concierge", lang)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {t("booking.step.vehicle", lang)}
                </span>
                <span className="text-right min-w-0 break-words">
                  {vehicleYear} {vehicleMake} {vehicleModel}{vehicleTrim ? ` · ${vehicleTrim}` : ""}
                </span>
              </div>
              {vehicleVin && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VIN</span>
                  <span className="font-mono text-xs">{vehicleVin}</span>
                </div>
              )}
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service ZIP</span>
                <span>{serviceZip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seller type</span>
                <span className="capitalize">{sellerType.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discovery source</span>
                <span className="capitalize">{listingSource.replace("_", " ")}{platformSource ? ` · ${platformSource.replace(/_/g, " ")}` : ""}</span>
              </div>
              {listingUrl && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Listing URL</span>
                  <span className="truncate max-w-[65%]" title={listingUrl}>{listingUrl}</span>
                </div>
              )}
              {(sellerName || sellerPhone || (isFacebookFlow && sellerEmail)) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seller</span>
                  <span>{[sellerName, sellerPhone, isFacebookFlow ? sellerEmail : ""].filter(Boolean).join(" · ")}</span>
                </div>
              )}
              {(isBuyerArranged || isFacebookFlow) && inspectionAddress && (
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
              {isFacebookFlow && sellerAvailableTime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seller availability time</span>
                  <span>{sellerAvailableTime}</span>
                </div>
              )}
              {isBuyerArranged && notesToInspector && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Inspector notes</span>
                  <span className="text-right max-w-[60%]">{notesToInspector}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Phone</span>
                <span data-testid="text-review-phone">{buyerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Email</span>
                <span data-testid="text-review-email">{buyerEmailInput}</span>
              </div>
              {preferredDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {isFacebookFlow ? "Requested inspection date" : t("booking.preferredDate", lang)}
                  </span>
                  <span>{preferredDate}</span>
                </div>
              )}
              <div className="border-t pt-3 mt-3 space-y-1">
                {isSelfArrange && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base price</span>
                      <span>{formatCurrency(basePrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Self-arranged discount</span>
                      <span>-{formatCurrency(10)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-base">
                  <span>{t("booking.total", lang)}</span>
                  <span data-testid="text-review-total">{formatCurrency(finalPrice)}</span>
                </div>
              </div>
              {isFacebookFlow ? (
                <p className="text-xs leading-relaxed text-slate-700 bg-blue-50 rounded-md p-3 mt-2 dark:bg-blue-950/30 dark:text-blue-200">
                  Facebook Marketplace uses Self-Arrange. After checkout, send the provided seller message through Messenger. Once the seller confirms, reply to your confirmation message with the confirmed date, time, and vehicle address. No dispatch until the seller confirms.
                </p>
              ) : effectiveBookingType === "concierge" && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 mt-2">
                  {t("booking.conciergeNote", lang)}
                </p>
              )}
              {!isFacebookFlow && (effectiveBookingType === "self_arrange" || isBuyerArranged) && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 mt-2">
                  {isBuyerArranged
                    ? t("booking.buyerArrangedNote", lang)
                    : t("booking.selfNote", lang)}
                </p>
              )}
              <p className="text-sm text-foreground bg-primary/5 rounded-md p-3 mt-2" data-testid="text-payment-first">
                {t("booking.paymentFirst", lang)}
              </p>
            </CardContent>
          </Card>
          </>
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
              onClick={handleNext}
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
