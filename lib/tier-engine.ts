export type PackageTier = "standard" | "plus" | "premium";

interface VehicleInfo {
  year?: number;
  make?: string;
  model?: string;
  price?: number;
}

export function getPackageTier(vehicle: VehicleInfo): PackageTier {
  const make = vehicle.make?.toLowerCase() || "";
  const model = vehicle.model?.toLowerCase() || "";

  // Premium brands
  if (
    make.includes("ferrari") ||
    make.includes("lamborghini") ||
    make.includes("bentley") ||
    make.includes("rolls")
  ) {
    return "premium";
  }

  // Electric / luxury mid-tier
  if (
    make.includes("tesla") ||
    make.includes("mercedes") ||
    make.includes("bmw") ||
    make.includes("audi")
  ) {
    return "plus";
  }

  // Default
  return "standard";
}

export function getPriceCents(
  tier: PackageTier,
  bookingMethod: "concierge" | "buyer_arranged"
): number {
  const basePrices = {
    standard: 12900,
    plus: 16900,
    premium: 24900,
  };

  const price = basePrices[tier];

  // 5% discount for buyer-arranged inspections
  if (bookingMethod === "buyer_arranged") {
    return Math.round(price * 0.95);
  }

  return price;
}

