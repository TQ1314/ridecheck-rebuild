import "server-only";

import type { ClassificationInput, ClassificationResult, VehicleTier } from "./vehicleClassification";
import { TIER_PRICES } from "./vehicleClassification";

export const TIER_CONFIG = {
  exotic_brands: [
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
    "maserati",
  ],

  plus_brands: [
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
    "volvo",
    "acura",
    "infiniti",
  ],

  exotic_model_overrides: [
    "911 turbo",
    "911 gt3",
    "911 gt2",
    "gt3 rs",
    "gt2 rs",
    "m5",
    "m8",
    "amg gt",
    "amg gts",
    "amg gt r",
    "amg gt s",
    "s-class",
    "s class",
    "s550",
    "s560",
    "s580",
    "s600",
    "s63",
    "s65",
    "maybach",
  ],

  value_thresholds: {
    exotic: 60000,
  },

  aging_thresholds: {
    luxury: { minAge: 15, minMileage: 150000, maxPrice: 10000 },
    plus:   { minAge: 15, minMileage: 150000, maxPrice: 8000 },
  },
} as const;

const EV_HYBRID_KEYWORDS = [
  "ev", "hybrid", "plug-in", "phev",
  "model s", "model 3", "model x", "model y", "cybertruck",
  "electric", "e-tron", "etron", "bolt ev", "bolt euv",
  "leaf", "ioniq", "mach-e", "id.4", "id.3", "mustang mach-e",
  "rivian", "lucid", "polestar",
];

const EV_MAKES = ["tesla", "rivian", "lucid", "polestar", "fisker"];

const THREE_ROW_SUV_KEYWORDS = [
  "highlander", "pilot", "telluride", "palisade", "explorer",
  "traverse", "tahoe", "suburban", "expedition", "sequoia",
  "armada", "qx80", "qx60", "pathfinder", "atlas", "ascent",
  "cx-9", "cx-90", "durango", "4runner", "land cruiser",
  "gx", "lx", "enclave", "acadia",
];

const HEAVY_DUTY_KEYWORDS = [
  "2500", "3500", "f-250", "f-350", "f250", "f350",
  "duramax", "cummins", "powerstroke", "power stroke",
  "sprinter", "super duty",
];

function matchesAny(value: string, keywords: readonly string[]): boolean {
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

  if ((TIER_CONFIG.exotic_brands as readonly string[]).includes(make)) {
    return {
      packageTier: "exotic",
      basePrice: TIER_PRICES.exotic,
      modifier: null,
      classificationReason: "Exotic brand",
      requiresUpgrade: true,
    };
  }

  if (price !== null && price >= TIER_CONFIG.value_thresholds.exotic) {
    return {
      packageTier: "exotic",
      basePrice: TIER_PRICES.exotic,
      modifier: null,
      classificationReason: `High value vehicle`,
      requiresUpgrade: true,
    };
  }

  const isExoticModel =
    matchesAny(model, TIER_CONFIG.exotic_model_overrides) ||
    matchesAny(makeModel, TIER_CONFIG.exotic_model_overrides);

  if (isExoticModel) {
    return {
      packageTier: "exotic",
      basePrice: TIER_PRICES.exotic,
      modifier: null,
      classificationReason: "High-complexity model",
      requiresUpgrade: true,
    };
  }

  const isPlusBrand = (TIER_CONFIG.plus_brands as readonly string[]).includes(make);

  if (isPlusBrand) {
    const { minAge, minMileage, maxPrice } = TIER_CONFIG.aging_thresholds.luxury;
    if (
      age >= minAge &&
      mileage !== null && mileage >= minMileage &&
      price !== null && price <= maxPrice
    ) {
      return {
        packageTier: "standard",
        basePrice: TIER_PRICES.standard,
        modifier: "aging_luxury",
        classificationReason: "Aging luxury vehicle",
        requiresUpgrade: false,
      };
    }
    return {
      packageTier: "plus",
      basePrice: TIER_PRICES.plus,
      modifier: null,
      classificationReason: "Luxury brand",
      requiresUpgrade: true,
    };
  }

  const isEV       = EV_MAKES.includes(make) || matchesAny(model, EV_HYBRID_KEYWORDS);
  const isThreeRow = matchesAny(model, THREE_ROW_SUV_KEYWORDS);
  const isHeavyDuty = matchesAny(model, HEAVY_DUTY_KEYWORDS);

  if (isEV || isThreeRow || isHeavyDuty) {
    const plusReason = isEV ? "EV/Hybrid vehicle" : isThreeRow ? "3-row SUV" : "Heavy-duty truck";
    const { minAge, minMileage, maxPrice } = TIER_CONFIG.aging_thresholds.plus;
    if (
      age >= minAge &&
      mileage !== null && mileage >= minMileage &&
      price !== null && price <= maxPrice
    ) {
      return {
        packageTier: "standard",
        basePrice: TIER_PRICES.standard,
        modifier: "aging_plus",
        classificationReason: "Aging complex vehicle",
        requiresUpgrade: false,
      };
    }
    return {
      packageTier: "plus",
      basePrice: TIER_PRICES.plus,
      modifier: null,
      classificationReason: plusReason,
      requiresUpgrade: true,
    };
  }

  return {
    packageTier: "standard",
    basePrice: TIER_PRICES.standard,
    modifier: null,
    classificationReason: "Standard vehicle",
    requiresUpgrade: false,
  };
}

export type { ClassificationInput, ClassificationResult, VehicleTier };
