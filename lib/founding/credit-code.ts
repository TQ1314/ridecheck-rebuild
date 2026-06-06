const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const TIER_CODES: Record<string, string> = {
  backer:           "T1",
  believer:         "T2",
  founding_partner: "T3",
};

export function generateCreditCode(tier: string): string {
  const tierCode = TIER_CODES[tier] ?? "T1";
  const year     = new Date().getFullYear();
  let random     = "";
  for (let i = 0; i < 6; i++) {
    random += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `RC-${tierCode}-${year}-${random}`;
}

export const TIER_CONFIG: Record<string, {
  label:        string;
  amountCents:  number;
  creditsCount: number;
  popular:      boolean;
  features:     string[];
}> = {
  backer: {
    label:        "The Backer",
    amountCents:  10_000,
    creditsCount: 1,
    popular:      false,
    features: [
      "1 Standard RideCheck Credit",
      "47-Point Vehicle Evaluation",
      "OBD-II Diagnostic Scan",
      "30+ Vehicle Photos",
      "Professional RideCheck Report",
      "Valid 24 Months",
      "Transferable",
    ],
  },
  believer: {
    label:        "The Believer",
    amountCents:  20_000,
    creditsCount: 1,
    popular:      true,
    features: [
      "1 Standard RideCheck Credit",
      "Priority Scheduling",
      "Founder Updates",
      "Founding Supporter Recognition",
      "Valid 24 Months",
      "Transferable",
    ],
  },
  founding_partner: {
    label:        "Founding Partner",
    amountCents:  30_000,
    creditsCount: 2,
    popular:      false,
    features: [
      "2 Standard RideCheck Credits",
      "Priority Scheduling",
      "Founder Updates",
      "Name on Founding Partners Page",
      "Valid 24 Months",
      "Transferable",
    ],
  },
};
