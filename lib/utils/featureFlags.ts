export const FEATURE_FLAGS = {
  BUYER_ARRANGED: "NEXT_PUBLIC_FEATURE_BUYER_ARRANGED",
  BILL_OF_SALE: "NEXT_PUBLIC_FEATURE_BILL_OF_SALE",
  INTELLIGENCE_REPORT: "NEXT_PUBLIC_FEATURE_INTELLIGENCE_REPORT",
  PAYMENT_HOLD: "NEXT_PUBLIC_FEATURE_PAYMENT_HOLD",
} as const;

export function isFeatureEnabled(flag: string): boolean {
  const value =
    typeof window !== "undefined"
      ? (process.env as Record<string, string | undefined>)[flag]
      : process.env[flag];
  if (!value) return false;
  return value === "true" || value === "1";
}

export function isBuyerArrangedEnabled(): boolean {
  return isFeatureEnabled(FEATURE_FLAGS.BUYER_ARRANGED);
}

export function isBillOfSaleEnabled(): boolean {
  return isFeatureEnabled(FEATURE_FLAGS.BILL_OF_SALE);
}

export function isIntelligenceReportEnabled(): boolean {
  return isFeatureEnabled(FEATURE_FLAGS.INTELLIGENCE_REPORT);
}

export function isPaymentHoldEnabled(): boolean {
  return isFeatureEnabled(FEATURE_FLAGS.PAYMENT_HOLD);
}
