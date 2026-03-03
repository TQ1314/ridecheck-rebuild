import { PAYOUT_RATES } from "@/lib/ridechecker/payouts";

interface CalcPayoutInput {
  base?: number;
  packageType?: string;
  distanceMiles?: number;
  urgencyAddon?: number;
  agencyMultiplier?: number;
}

export function calcPayout(input: CalcPayoutInput): number {
  const base = input.base ?? (input.packageType ? (PAYOUT_RATES[input.packageType] || PAYOUT_RATES.standard) : PAYOUT_RATES.standard);
  const distance = input.distanceMiles ?? 0;
  const urgency = input.urgencyAddon ?? 0;
  const multiplier = input.agencyMultiplier ?? 1;

  const distanceAddon = distance > 25 ? Math.round((distance - 25) * 0.5) : 0;

  const total = (base + distanceAddon + urgency) * multiplier;

  return Math.round(total * 100) / 100;
}
