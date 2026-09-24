export interface BatchChildPayout {
  id: string;
  status: string;
}

/** Validate the complete child set before a batch can claim completion. */
export function validateBatchChildren(
  payouts: BatchChildPayout[],
  expectedCount: number,
): string | null {
  if (expectedCount < 1 || payouts.length !== expectedCount) {
    return "Batch child payout count does not match the recorded batch count.";
  }
  if (payouts.some((p) => p.status !== "approved")) {
    return "Every child payout must still be approved before batch completion.";
  }
  return null;
}