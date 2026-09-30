import { classifyVehicle, type ClassificationInput } from "../vehicleClassification";

export type BookingType = "self_arrange" | "concierge" | "buyer_arranged";
export type PackageType = "standard" | "plus" | "premium" | "exotic";

export type PackageTier = "standard" | "plus" | "premium" | "exotic";

export const SELF_ARRANGE_DISCOUNT = 10;

export const PRICING: Record<PackageType, { full: number; self: number }> = {
  standard: { full: 139, self: 129 },
  plus: { full: 169, self: 159 },
  premium: { full: 169, self: 159 }, // Legacy stored package alias; not a bookable tier.
  exotic: { full: 299, self: 289 },
};

export function getPrice(pkg: PackageType, bookingType: BookingType) {
  const prices = PRICING[pkg];
  if (!prices) {
    return { basePrice: 0, finalPrice: 0, discountAmount: 0 };
  }
  const isSelfArrange = bookingType === "self_arrange" || bookingType === "buyer_arranged";
  const basePrice = prices.full;
  const finalPrice = isSelfArrange ? prices.self : prices.full;
  const discountAmount = isSelfArrange ? SELF_ARRANGE_DISCOUNT : 0;
  return { basePrice, finalPrice, discountAmount };
}

export function getPriceCents(
  tier: PackageTier | PackageType,
  bookingMethod: BookingType,
): number {
  const { finalPrice } = getPrice(tier as PackageType, bookingMethod);
  return Math.round(finalPrice * 100);
}

export function getPackageTier(vehicle: Partial<ClassificationInput>): PackageTier {
  return classifyVehicle({
    make: vehicle.make || "",
    model: vehicle.model || "",
    year: vehicle.year || new Date().getFullYear(),
    mileage: vehicle.mileage,
    askingPrice: vehicle.askingPrice,
    fuelType: vehicle.fuelType,
    collector: vehicle.collector,
  }).packageTier;
}

export function formatCurrency(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

/**
 * @deprecated Use `detectSellerPlatform` from `@/lib/seller-contact/platforms`
 * instead — it also detects CarGurus, Autotrader, Cars.com, Carfax, and TrueCar.
 * This function is kept only for backward-compatibility with the booking form.
 */
export function detectListingPlatform(
  url: string,
): "facebook" | "craigslist" | "other" | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (
      hostname.includes("facebook.com") ||
      hostname.includes("fb.com") ||
      hostname.includes("marketplace")
    ) {
      return "facebook";
    }
    if (hostname.includes("craigslist.org")) {
      return "craigslist";
    }
    return "other";
  } catch {
    return null;
  }
}

export const PACKAGE_INFO: Record<
  PackageType,
  { name: string; tagline: string; features: string[] }
> = {
  standard: {
    name: "Standard",
    tagline: "Essential vehicle screening for informed decisions",
    features: [
      "Comprehensive multi-module inspection",
      "Engine & transmission check",
      "Brake system evaluation",
      "Tire condition assessment",
      "Basic electrical check",
      "Photo documentation",
      "Digital report within 24hrs",
    ],
  },
  plus: {
    name: "Plus",
    tagline: "European, EV, hybrid, diesel & heavy-duty screening",
    features: [
      "Everything in Standard",
      "OBD-II diagnostic scan",
      "Undercarriage inspection",
      "Paint depth measurement",
      "Fluid analysis",
      "Road test evaluation",
      "Euro/EV/hybrid-specific checks",
      "Frame & structural analysis",
      "VIN consistency check",
      "Report within 12hrs",
    ],
  },
  premium: {
    name: "Plus",
    tagline: "Euro, EV, hybrid & higher-complexity screening",
    features: [
      "Everything in Standard",
      "OBD-II diagnostic scan",
      "Undercarriage inspection",
      "Paint depth measurement",
      "Fluid analysis",
      "Road test evaluation",
      "Euro/EV/hybrid-specific checks",
      "Frame & structural analysis",
      "VIN consistency check",
      "Report within 12hrs",
    ],
  },
  exotic: {
    name: "Premium/Exotic",
    tagline: "Full pre-purchase intelligence for exotic, performance & collector vehicles",
    features: [
      "Everything in Plus",
      "Title & ownership review",
      "Market value assessment",
      "Negotiation support data",
      "Dedicated RideChecker",
      "Fraud & red flag screening",
      "Report within 6hrs",
      "30-day follow-up support",
    ],
  },
};
