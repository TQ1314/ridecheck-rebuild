/**
 * Money unit boundary helpers.
 *
 * Compensation offers and the legacy payout tables store whole dollars.
 * Payment/ledger providers use integer cents. Keep conversions explicit at
 * boundaries rather than sprinkling *100 or /100 throughout the app.
 */
export function dollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars)) throw new Error("Invalid dollar amount");
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  if (!Number.isFinite(cents)) throw new Error("Invalid cent amount");
  return cents / 100;
}

export function formatDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD" });
}