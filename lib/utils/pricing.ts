export type BookingType = "self_arrange" | "concierge" | "buyer_arranged";
export type PackageType = "standard" | "premium" | "comprehensive" | "plus";

export type PackageTier = "standard" | "plus" | "premium";

export const PRICING: Record<PackageType, { full: number; self: number }> = {
  standard: { full: 119, self: 113 },
  plus: { full: 149, self: 142 },
  premium: { full: 179, self: 170 },
  comprehensive: { full: 299, self: 284 },
};

const BUYER_ARRANGED_DISCOUNT = 0.05;

export function getPrice(pkg: PackageType, bookingType: BookingType) {
  const prices = PRICING[pkg];
  if (!prices) {
    return { basePrice: 0, finalPrice: 0, discountAmount: 0 };
  }
  const basePrice = prices.full;
  const isSelfOrBuyer =
    bookingType === "self_arrange" || bookingType === "buyer_arranged";
  const finalPrice = isSelfOrBuyer ? prices.self : prices.full;
  const discountAmount = basePrice - finalPrice;
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

  const euroExoticMakes = [
    "mercedes-benz",
    "mercedes",
    "bmw",
    "audi",
    "porsche",
    "volkswagen",
    "volvo",
    "jaguar",
    "land rover",
    "range rover",
    "mini",
    "alfa romeo",
    "fiat",
    "maserati",
    "bentley",
    "rolls-royce",
    "aston martin",
    "mclaren",
    "ferrari",
    "lamborghini",
    "bugatti",
    "lotus",
    "saab",
    "peugeot",
    "citroën",
    "citroen",
  ];

  const evModels = ["model s", "model 3", "model x", "model y", "cybertruck"];
  const evMakes = ["tesla", "rivian", "lucid", "polestar", "fisker"];

  const premiumExoticMakes = [
    "ferrari",
    "lamborghini",
    "bugatti",
    "mclaren",
    "rolls-royce",
    "bentley",
    "aston martin",
    "lotus",
    "maserati",
    "pagani",
    "koenigsegg",
  ];

  if (premiumExoticMakes.includes(make)) {
    return "premium";
  }

  if (euroExoticMakes.includes(make) || evMakes.includes(make)) {
    return "plus";
  }
  if (evModels.includes(model)) {
    return "plus";
  }

  const heavyDutyKeywords = [
    "f-250",
    "f-350",
    "f250",
    "f350",
    "2500",
    "3500",
    "duramax",
    "cummins",
    "powerstroke",
    "diesel",
    "sprinter",
  ];
  if (heavyDutyKeywords.some((kw) => model.includes(kw))) {
    return "plus";
  }

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
    name: "Standard",
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
    tagline: "Euro, EV & heavy-duty specialist screening",
    features: [
      "Everything in Standard",
      "OBD-II diagnostic scan",
      "Undercarriage inspection",
      "Paint depth measurement",
      "Fluid analysis",
      "Road test evaluation",
      "Euro/EV/HD-specific checks",
      "Report within 12hrs",
    ],
  },
  premium: {
    name: "Premium",
    tagline: "Comprehensive diagnostics with detailed analysis",
    features: [
      "Everything in Plus",
      "Frame & structural analysis",
      "VIN consistency check",
      "Fraud & red flag screening",
      "Video walkthrough",
      "Priority scheduling",
      "Report within 12hrs",
    ],
  },
  comprehensive: {
    name: "Comprehensive",
    tagline: "Full pre-car-purchase intelligence package",
    features: [
      "Everything in Premium",
      "Title & ownership review",
      "Market value assessment",
      "Negotiation support data",
      "Dedicated inspector",
      "Report within 6hrs",
      "30-day follow-up support",
    ],
  },
};
