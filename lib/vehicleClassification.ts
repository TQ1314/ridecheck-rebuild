export type VehicleTier = "standard" | "plus" | "exotic";
export type TierModifier = "aging_luxury" | "aging_plus" | null;

export interface ClassificationInput {
  make: string;
  model: string;
  year: number;
  mileage?: number | null;
  askingPrice?: number | null;
  fuelType?: "gasoline" | "diesel" | "hybrid" | "electric" | null;
  collector?: boolean;
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

// Keep these rules shared between the booking quote and the server's order price.
export const TIER_CONFIG = {
  exotic_brands: ["ferrari", "lamborghini", "mclaren", "bentley", "rolls-royce", "aston martin", "bugatti", "pagani", "koenigsegg", "lotus", "maserati"],
  plus_brands: ["mercedes-benz", "mercedes benz", "mercedes", "bmw", "audi", "porsche", "land rover", "range rover", "jaguar", "volvo", "volkswagen", "vw", "mini", "saab", "alfa romeo", "fiat", "peugeot", "renault", "citroen", "skoda", "seat", "opel", "vauxhall", "smart", "ineos", "lancia", "dacia", "cupra", "abarth"],
  performance_models: ["911", "gt3", "gt2", "m5", "m8", "amg gt"],
} as const;

const EV_MAKES = ["tesla", "rivian", "lucid", "polestar", "fisker"];
const EV_HYBRID_MODELS = ["ev", "hybrid", "plug-in", "phev", "electric", "e-tron", "etron", "bolt ev", "bolt euv", "leaf", "ioniq", "mach-e", "id.4", "id.3", "cybertruck", "prius"];
const HEAVY_DUTY_MODELS = ["2500", "3500", "f-250", "f-350", "f250", "f350", "sprinter", "super duty"];
const DIESEL_MODELS = ["diesel", "tdi", "duramax", "cummins", "powerstroke", "power stroke"];

function hasToken(text: string, token: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`).test(text);
}

export function classifyVehicle(input: ClassificationInput): ClassificationResult {
  const make = (input.make || "").trim().toLowerCase();
  const model = (input.model || "").trim().toLowerCase();
  const fuel = input.fuelType;
  let packageTier: VehicleTier = "standard";
  let classificationReason = "Standard gasoline vehicle";

  if (input.collector) {
    packageTier = "exotic";
    classificationReason = "Collector vehicle";
  } else if (TIER_CONFIG.exotic_brands.some((brand) => brand === make)) {
    packageTier = "exotic";
    classificationReason = "Exotic make";
  } else if (
    TIER_CONFIG.performance_models.some((name) => hasToken(model, name)) ||
    (["mercedes", "mercedes-benz", "mercedes benz"].includes(make) && ["s63", "s65", "s 63", "s 65"].some((name) => hasToken(model, name)))
  ) {
    packageTier = "exotic";
    classificationReason = "Performance model";
  } else if (TIER_CONFIG.plus_brands.some((brand) => brand === make)) {
    packageTier = "plus";
    classificationReason = "European or specialty make";
  } else if (EV_MAKES.includes(make) || fuel === "electric" || fuel === "hybrid" || EV_HYBRID_MODELS.some((name) => hasToken(model, name))) {
    packageTier = "plus";
    classificationReason = "Electric or hybrid vehicle";
  } else if (fuel === "diesel" || DIESEL_MODELS.some((name) => hasToken(model, name))) {
    packageTier = "plus";
    classificationReason = "Diesel vehicle";
  } else if (HEAVY_DUTY_MODELS.some((name) => hasToken(model, name))) {
    packageTier = "plus";
    classificationReason = "Heavy-duty vehicle";
  }

  return {
    packageTier,
    basePrice: TIER_PRICES[packageTier],
    modifier: null,
    classificationReason,
    requiresUpgrade: packageTier !== "standard",
  };
}

export default TIER_PRICES;
