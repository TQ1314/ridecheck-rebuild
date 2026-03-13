export const TERMS_VERSION = "v1.0";
export const INSPECTION_SCOPE_VERSION = "scope-v1.0";

export const APPROVED_RECOMMENDATIONS = [
  "BUY",
  "BUY_WITH_NEGOTIATION",
  "DO_NOT_BUY_AT_ASKING_PRICE",
  "FURTHER_INSPECTION_REQUIRED",
] as const;

export type ApprovedRecommendation = typeof APPROVED_RECOMMENDATIONS[number];

export const RECOMMENDATION_LABELS: Record<ApprovedRecommendation, string> = {
  BUY: "Buy",
  BUY_WITH_NEGOTIATION: "Buy with Negotiation",
  DO_NOT_BUY_AT_ASKING_PRICE: "Do Not Buy at Asking Price",
  FURTHER_INSPECTION_REQUIRED: "Further Inspection Required",
};

export const LEGAL_DISCLAIMER = `RideCheck provides a visual, non-invasive vehicle inspection and OBD-based informational report only. This inspection is limited to observable conditions at the time of inspection and is not a warranty, guarantee, certification, or prediction of future vehicle performance.

RideCheck does not perform engine teardown, compression testing, internal transmission inspection, frame measurement, or any other destructive or invasive testing unless explicitly stated otherwise.

Repair estimates are informed estimates only and are not binding quotes. Actual repair costs may vary. The final purchase decision remains solely the responsibility of the buyer.

This report is intended solely for the requesting client. Third parties should not rely on this report. RideCheck is not a party to any vehicle sale transaction.

To the maximum extent permitted by law, RideCheck's liability for any claim arising from this inspection is limited to the amount paid for the inspection service.`;

export const LEGAL_SUMMARY_BULLETS = [
  "RideCheck is a visual, non-invasive inspection service.",
  "RideCheck does not guarantee future vehicle condition or performance.",
  "Repair estimates are non-binding informed estimates only.",
  "The buyer remains solely responsible for the final purchase decision.",
  "RideCheck liability is limited to the inspection fee paid.",
  "This report is for the requesting client only.",
];
