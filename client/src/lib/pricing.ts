import type { BookingType, Package } from "@shared/schema";

export const PRICING: Record<Package, { full: number; self: number }> = {
  standard: { full: 119, self: 113 },
  premium: { full: 179, self: 170 },
  comprehensive: { full: 299, self: 284 },
};

export function getPrice(pkg: Package, bookingType: BookingType): number {
  return bookingType === "self_arrange" ? PRICING[pkg].self : PRICING[pkg].full;
}

export function getDiscount(pkg: Package): number {
  return PRICING[pkg].full - PRICING[pkg].self;
}

export function formatPrice(price: number | string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return `$${num.toFixed(0)}`;
}

export const PACKAGE_DETAILS: Record<
  Package,
  { name: string; description: string; features: string[] }
> = {
  standard: {
    name: "Standard",
    description: "Essential inspection for peace of mind",
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
    description: "Comprehensive check with detailed diagnostics",
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
    description: "The ultimate pre-purchase inspection",
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
