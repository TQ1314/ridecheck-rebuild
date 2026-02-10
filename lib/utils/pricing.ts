export type BookingType = "self_arrange" | "concierge";
export type PackageType = "standard" | "premium" | "comprehensive";

export const PRICING: Record<PackageType, { full: number; self: number }> = {
  standard: { full: 119, self: 113 },
  premium: { full: 179, self: 170 },
  comprehensive: { full: 299, self: 284 },
};

export function getPrice(pkg: PackageType, bookingType: BookingType) {
  const prices = PRICING[pkg];
  const basePrice = prices.full;
  const finalPrice = bookingType === "self_arrange" ? prices.self : prices.full;
  const discountAmount = basePrice - finalPrice;
  return { basePrice, finalPrice, discountAmount };
}

export function formatCurrency(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

export const PACKAGE_INFO: Record<
  PackageType,
  { name: string; tagline: string; features: string[] }
> = {
  standard: {
    name: "Standard",
    tagline: "Essential inspection for peace of mind",
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
  premium: {
    name: "Premium",
    tagline: "Comprehensive check with detailed diagnostics",
    features: [
      "Everything in Standard",
      "OBD-II diagnostic scan",
      "Undercarriage inspection",
      "Paint depth measurement",
      "Fluid analysis",
      "Road test evaluation",
      "Video walkthrough",
      "Report within 12hrs",
    ],
  },
  comprehensive: {
    name: "Comprehensive",
    tagline: "The ultimate pre-purchase inspection",
    features: [
      "Everything in Premium",
      "Frame & structural analysis",
      "VIN history verification",
      "Market value assessment",
      "Negotiation report",
      "Priority scheduling",
      "Dedicated inspector",
      "Report within 6hrs",
      "30-day follow-up support",
    ],
  },
};
