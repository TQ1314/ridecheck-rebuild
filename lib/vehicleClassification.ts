export type VehicleTier = "standard" | "plus" | "exotic";
export type TierModifier = "aging_luxury" | "aging_plus" | null;

export interface ClassificationInput {
  make: string;
  model: string;
  year: number;
  mileage?: number | null;
  askingPrice?: number | null;
}

export interface ClassificationResult {
  packageTier: VehicleTier;
  basePrice: number;
  modifier: TierModifier;
  classificationReason: string;
  requiresUpgrade: boolean;
}

export const TIER_PRICES: Record<VehicleTier, number> = {
  standard: 139,
  plus: 169,
  exotic: 299,
};

export default TIER_PRICES;
