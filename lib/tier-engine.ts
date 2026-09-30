// Compatibility entry point: keep old callers on the same classification and
// price schedule as the booking flow. "premium" is a legacy Plus alias.
import { classifyVehicle } from "./vehicleClassification";
import { getPriceCents as priceCents } from "./utils/pricing";

export type PackageTier = "standard" | "plus" | "premium" | "exotic";

export function getPackageTier(vehicle: {
  year?: number; make?: string; model?: string; price?: number;
}): PackageTier {
  return classifyVehicle({
    make: vehicle.make || "",
    model: vehicle.model || "",
    year: vehicle.year || new Date().getFullYear(),
    askingPrice: vehicle.price,
  }).packageTier;
}

export function getPriceCents(
  tier: PackageTier,
  bookingMethod: "concierge" | "buyer_arranged",
): number {
  return priceCents(tier, bookingMethod);
}