import "server-only";

import {
  classifyVehicle, TIER_CONFIG,
  type ClassificationInput, type ClassificationResult, type VehicleTier,
} from "./vehicleClassification";

export { classifyVehicle, TIER_CONFIG };
export type { ClassificationInput, ClassificationResult, VehicleTier };

export interface ClassificationResultInternal extends ClassificationResult {
  signals_triggered: string[];
  risk_flags: Record<string, unknown>;
}

export function classifyVehicleInternal(input: ClassificationInput): ClassificationResultInternal {
  const result = classifyVehicle(input);
  const signals: string[] = [];
  const riskFlags: Record<string, unknown> = {};
  const age = new Date().getFullYear() - input.year;
  if (age >= 10) signals.push("VEHICLE_AGE_10_PLUS");
  if (input.mileage != null && input.mileage >= 100000) {
    signals.push("HIGH_MILEAGE");
    riskFlags.high_mileage = input.mileage;
  }
  if (input.mileage != null && input.mileage >= 150000) signals.push("VERY_HIGH_MILEAGE");
  if (input.askingPrice != null && input.askingPrice < 5000) {
    signals.push("LOW_ASK_PRICE");
    riskFlags.low_price = input.askingPrice;
  }
  if (input.askingPrice != null && input.askingPrice >= 60000) {
    signals.push("HIGH_VALUE");
    riskFlags.high_value_price = input.askingPrice;
  }
  signals.push(result.packageTier.toUpperCase());
  return { ...result, signals_triggered: signals, risk_flags: riskFlags };
}