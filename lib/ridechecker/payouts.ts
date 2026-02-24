export const PAYOUT_RATES: Record<string, number> = {
  standard: 50,
  plus: 65,
  premium: 80,
  comprehensive: 130,
};

export function getPayoutAmount(packageType: string): number {
  return PAYOUT_RATES[packageType] || PAYOUT_RATES.standard;
}
