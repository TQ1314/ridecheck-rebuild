export type VehicleTier = "standard" | "plus" | "premium" | "exotic";
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
}

const TIER_PRICES: Record<VehicleTier, number> = {
  standard: 139,
  plus: 169,
  premium: 189,
  exotic: 299,
};

const EXOTIC_MAKES = [
  "ferrari",
  "lamborghini",
  "mclaren",
  "bentley",
  "rolls-royce",
  "aston martin",
  "bugatti",
  "pagani",
  "koenigsegg",
  "lotus",
];

const LUXURY_MAKES = [
  "mercedes-benz",
  "mercedes",
  "bmw",
  "audi",
  "porsche",
  "lexus",
  "land rover",
  "range rover",
  "jaguar",
  "tesla",
];

const FLAGSHIP_KEYWORDS = [
  "s-class",
  "s class",
  "s550",
  "s500",
  "s580",
  "s600",
  "s63",
  "s65",
  "7 series",
  "7-series",
  "740",
  "745",
  "750",
  "760",
  "a8",
  "range rover",
  "escalade",
  "navigator",
  "maybach",
];

const EV_HYBRID_KEYWORDS = [
  "ev",
  "hybrid",
  "plug-in",
  "phev",
  "model s",
  "model 3",
  "model x",
  "model y",
  "cybertruck",
  "electric",
  "e-tron",
  "etron",
  "bolt ev",
  "bolt euv",
  "leaf",
  "ioniq",
  "mach-e",
  "id.4",
  "id.3",
  "mustang mach-e",
  "rivian",
  "lucid",
  "polestar",
];

const EV_MAKES = ["tesla", "rivian", "lucid", "polestar", "fisker"];

const THREE_ROW_SUV_KEYWORDS = [
  "highlander",
  "pilot",
  "telluride",
  "palisade",
  "explorer",
  "traverse",
  "tahoe",
  "suburban",
  "expedition",
  "sequoia",
  "armada",
  "qx80",
  "qx60",
  "pathfinder",
  "atlas",
  "ascent",
  "cx-9",
  "cx-90",
  "durango",
  "4runner",
  "land cruiser",
  "gx",
  "lx",
  "enclave",
  "acadia",
];

const HEAVY_DUTY_KEYWORDS = [
  "2500",
  "3500",
  "f-250",
  "f-350",
  "f250",
  "f350",
  "duramax",
  "cummins",
  "powerstroke",
  "power stroke",
  "sprinter",
  "super duty",
];

function matchesAny(value: string, keywords: string[]): boolean {
  return keywords.some((kw) => value.includes(kw));
}

export function classifyVehicle(input: ClassificationInput): ClassificationResult {
  const make = (input.make || "").toLowerCase().trim();
  const model = (input.model || "").toLowerCase().trim();
  const makeModel = `${make} ${model}`;
  const currentYear = new Date().getFullYear();
  const age = currentYear - (input.year || currentYear);
  const mileage = input.mileage ?? null;
  const price = input.askingPrice ?? null;

  if (EXOTIC_MAKES.includes(make)) {
    return {
      packageTier: "exotic",
      basePrice: TIER_PRICES.exotic,
      modifier: null,
      classificationReason: "Exotic brand",
    };
  }

  if (price !== null && price >= 60000) {
    return {
      packageTier: "exotic",
      basePrice: TIER_PRICES.exotic,
      modifier: null,
      classificationReason: "High value vehicle (>=$60k)",
    };
  }

  const isLuxuryMake = LUXURY_MAKES.includes(make);
  const isFlagship = matchesAny(model, FLAGSHIP_KEYWORDS) || matchesAny(makeModel, FLAGSHIP_KEYWORDS);

  if (isLuxuryMake || isFlagship) {
    if (
      age >= 15 &&
      mileage !== null && mileage >= 150000 &&
      price !== null && price <= 10000
    ) {
      return {
        packageTier: "plus",
        basePrice: TIER_PRICES.plus,
        modifier: "aging_luxury",
        classificationReason: `Luxury brand but age=${age}yr, ${mileage?.toLocaleString()}mi, $${price?.toLocaleString()} — downgraded from Premium`,
      };
    }

    return {
      packageTier: "premium",
      basePrice: TIER_PRICES.premium,
      modifier: null,
      classificationReason: isLuxuryMake
        ? "Luxury brand"
        : "Flagship model",
    };
  }

  const isEV = EV_MAKES.includes(make) || matchesAny(model, EV_HYBRID_KEYWORDS) || matchesAny(makeModel, EV_HYBRID_KEYWORDS);
  const isThreeRow = matchesAny(model, THREE_ROW_SUV_KEYWORDS);
  const isHeavyDuty = matchesAny(model, HEAVY_DUTY_KEYWORDS);

  if (isEV || isThreeRow || isHeavyDuty) {
    const plusReason = isEV
      ? "EV/Hybrid vehicle"
      : isThreeRow
        ? "3-row SUV"
        : "Heavy-duty truck";

    if (
      age >= 15 &&
      mileage !== null && mileage >= 150000 &&
      price !== null && price <= 8000
    ) {
      return {
        packageTier: "standard",
        basePrice: TIER_PRICES.standard,
        modifier: "aging_plus",
        classificationReason: `${plusReason} but age=${age}yr, ${mileage?.toLocaleString()}mi, $${price?.toLocaleString()} — downgraded from Plus`,
      };
    }

    return {
      packageTier: "plus",
      basePrice: TIER_PRICES.plus,
      modifier: null,
      classificationReason: plusReason,
    };
  }

  return {
    packageTier: "standard",
    basePrice: TIER_PRICES.standard,
    modifier: null,
    classificationReason: "Standard vehicle",
  };
}

export { TIER_PRICES };
