export const PAYOUT_RATES: Record<string, number> = {
  standard: 50,
  plus: 65,
  premium: 80,
  exotic: 130,
  comprehensive: 130,
  test: 1,
};

export function getPayoutAmount(packageType: string): number {
  return PAYOUT_RATES[packageType] || PAYOUT_RATES.standard;
}
