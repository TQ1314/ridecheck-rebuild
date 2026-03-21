export type BookingType = "self_arrange" | "concierge" | "buyer_arranged";
export type PackageType = "standard" | "plus" | "premium" | "exotic" | "test";

export type PackageTier = "standard" | "plus" | "premium" | "exotic" | "test";

export const PRICING: Record<PackageType, { full: number; self: number }> = {
  standard: { full: 139, self: 139 },
  plus: { full: 169, self: 169 },
  premium: { full: 169, self: 169 },
  exotic: { full: 299, self: 299 },
  test: { full: 1, self: 1 },
};

export function getPrice(pkg: PackageType, bookingType: BookingType) {
  const prices = PRICING[pkg];
  if (!prices) {
    return { basePrice: 0, finalPrice: 0, discountAmount: 0 };
  }
  const basePrice = prices.full;
  const finalPrice = prices.full;
  const discountAmount = 0;
  return { basePrice, finalPrice, discountAmount };
}

export function getPriceCents(
  tier: PackageTier | PackageType,
  bookingMethod: BookingType,
): number {
  const { finalPrice } = getPrice(tier as PackageType, bookingMethod);
  return Math.round(finalPrice * 100);
}

export function getPackageTier(vehicle: {
  make?: string;
  model?: string;
  year?: number;
}): PackageTier {
  const make = (vehicle.make || "").toLowerCase();
  const model = (vehicle.model || "").toLowerCase();

  const exoticMakes = ["ferrari", "lamborghini", "mclaren", "bentley", "rolls-royce", "aston martin", "bugatti", "pagani", "koenigsegg", "lotus", "maserati"];
  if (exoticMakes.includes(make)) return "exotic";

  const plusMakes = ["mercedes-benz", "mercedes", "bmw", "audi", "porsche", "lexus", "land rover", "range rover", "jaguar", "tesla", "volvo", "acura", "infiniti"];
  if (plusMakes.includes(make)) return "plus";

  const evMakes = ["rivian", "lucid", "polestar", "fisker"];
  if (evMakes.includes(make)) return "plus";

  const evKeywords = ["ev", "hybrid", "plug-in", "phev", "electric", "e-tron", "mach-e"];
  if (evKeywords.some((kw) => model.includes(kw))) return "plus";

  const threeRowKeywords = ["highlander", "pilot", "telluride", "palisade", "explorer", "traverse", "tahoe", "suburban", "expedition", "sequoia", "armada"];
  if (threeRowKeywords.some((kw) => model.includes(kw))) return "plus";

  const heavyDutyKeywords = ["f-250", "f-350", "f250", "f350", "2500", "3500", "duramax", "cummins", "powerstroke", "sprinter"];
  if (heavyDutyKeywords.some((kw) => model.includes(kw))) return "plus";

  return "standard";
}

export function formatCurrency(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

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
    name: "Basic",
    tagline: "Essential vehicle screening for informed decisions",
    features: [
      "150+ point inspection",
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
    tagline: "Euro, EV, hybrid & higher-complexity screening",
    features: [
      "Everything in Basic",
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
      "Everything in Basic",
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
    name: "Exotic",
    tagline: "Full pre-purchase intelligence for specialty vehicles",
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
  test: {
    name: "$1 Test",
    tagline: "Internal testing — full flow for $1",
    features: [
      "End-to-end flow test",
      "$1 Stripe payment",
      "$1 RideChecker payout",
      "All workflow steps included",
    ],
  },
};
