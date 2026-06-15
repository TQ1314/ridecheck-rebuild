export interface CompOfferInput {
  packageType: string;
  distanceMiles?: number;
  preferredDate?: string | null;
  sellerAvailableDate?: string | null;
  sellerAvailableTime?: string | null;
  surgeBonus?: number;
}

export interface CompOfferResult {
  basePay: number;
  distanceBonus: number;
  sameDayBonus: number;
  rushBonus: number;
  surgeBonus: number;
  totalOffer: number;
  isSameDay: boolean;
  isRush: boolean;
  isManualReview: boolean;
  requiresOpsLead: boolean;
  notes: string[];
}

const BASE_PAY: Record<string, number> = {
  standard:      50,
  basic:         50,
  plus:          60,
  premium:       70,
  exotic:         0,
  comprehensive:  0,
};

export function calcOffer(input: CompOfferInput): CompOfferResult {
  const pkg = (input.packageType || "standard").toLowerCase();
  const basePay = BASE_PAY[pkg] ?? 50;
  const isManualReview = pkg === "exotic" || pkg === "comprehensive";

  // Distance bonus
  const distance = input.distanceMiles ?? 0;
  let distanceBonus = 0;
  let requiresOpsLead = false;
  if (distance <= 10) {
    distanceBonus = 0;
  } else if (distance <= 20) {
    distanceBonus = 5;
  } else if (distance <= 30) {
    distanceBonus = 10;
  } else if (distance <= 40) {
    distanceBonus = 15;
  } else {
    distanceBonus = 0;
    requiresOpsLead = true;
  }

  // Resolve inspection date/time
  const inspectionDate = input.sellerAvailableDate || input.preferredDate || null;
  const inspectionTime = input.sellerAvailableTime || null;

  // Rush check: scheduled < 4 hours from now
  let rushBonus = 0;
  let isRush = false;
  if (inspectionDate && inspectionTime) {
    try {
      const inspDt = new Date(`${inspectionDate}T${inspectionTime}`);
      const hoursUntil = (inspDt.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil > 0 && hoursUntil < 4) {
        rushBonus = 15;
        isRush = true;
      }
    } catch {
      // ignore parse errors
    }
  }

  // Same-day check (only if not already rush)
  let sameDayBonus = 0;
  let isSameDay = false;
  if (!isRush && inspectionDate) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const iDate = new Date(inspectionDate).toISOString().slice(0, 10);
      if (iDate === today) {
        sameDayBonus = 10;
        isSameDay = true;
      }
    } catch {
      // ignore parse errors
    }
  }

  const surgeBonus = input.surgeBonus ?? 0;

  const totalOffer = isManualReview
    ? 0
    : basePay + distanceBonus + sameDayBonus + rushBonus + surgeBonus;

  const notes: string[] = [];
  if (isManualReview) {
    notes.push("Exotic/Specialty vehicle — manual review required for pricing.");
  }
  if (requiresOpsLead) {
    notes.push("Distance over 40 miles — Ops Lead approval required.");
  }
  if (isRush) {
    notes.push("Rush inspection (< 4 hours) — $15 rush bonus applied.");
  } else if (isSameDay) {
    notes.push("Same-day inspection — $10 bonus applied.");
  }

  return {
    basePay,
    distanceBonus,
    sameDayBonus,
    rushBonus,
    surgeBonus,
    totalOffer,
    isSameDay,
    isRush,
    isManualReview,
    requiresOpsLead,
    notes,
  };
}
