import type { PackageType } from "./pricing";

export const RIDECHECKER_PAY_RATES: Record<string, number> = {
  standard: 55,
  plus: 70,
  premium: 85,
  comprehensive: 140,
};

export function getRidecheckerPay(pkg: string): number {
  return RIDECHECKER_PAY_RATES[pkg] || RIDECHECKER_PAY_RATES.standard;
}
