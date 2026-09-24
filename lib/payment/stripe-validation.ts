export type StripePaymentCheck = {
  expectedAmountCents: number;
  expectedCurrency: string;
  receivedAmountCents: number | null;
  receivedCurrency: string | null;
};

export function expectedStripeAmountCents(params: {
  orderPriceDollars: number;
  serviceFeeCents?: number;
  stripeTaxCents?: number;
  includesTax?: boolean;
}): number {
  const subtotal = Math.round(params.orderPriceDollars * 100) + (params.serviceFeeCents ?? 0);
  return subtotal + (params.includesTax ? (params.stripeTaxCents ?? 0) : 0);
}

export function stripePaymentMatches(check: StripePaymentCheck): boolean {
  return check.receivedAmountCents !== null
    && check.receivedAmountCents === check.expectedAmountCents
    && check.receivedCurrency?.toLowerCase() === check.expectedCurrency.toLowerCase();
}

export function stripeObjectMatchesOrder(params: {
  metadataOrderId?: string | null;
  targetOrderId: string;
  alreadyLinked: boolean;
}): boolean {
  if (params.metadataOrderId && params.metadataOrderId !== params.targetOrderId) return false;
  return params.alreadyLinked || !!params.metadataOrderId;
}