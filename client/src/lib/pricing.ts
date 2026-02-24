import type { BookingType, Package } from "@shared/schema";

export const PRICING: Record<Package, { full: number; self: number }> = {
  standard: { full: 139, self: 139 },
  plus: { full: 169, self: 169 },
  premium: { full: 189, self: 189 },
  exotic: { full: 299, self: 299 },
  comprehensive: { full: 299, self: 299 },
};

export function getPrice(pkg: Package, bookingType: BookingType): number {
  const prices = PRICING[pkg];
  return prices ? prices.full : 0;
}

export function getDiscount(pkg: Package): number {
  return 0;
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
  plus: {
    name: "Plus",
    description: "Euro, EV & heavy-duty specialist screening",
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
    description: "Luxury & flagship vehicle diagnostics",
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
  exotic: {
    name: "Exotic",
    description: "The ultimate pre-purchase inspection",
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
  comprehensive: {
    name: "Comprehensive",
    description: "The ultimate pre-purchase inspection",
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
