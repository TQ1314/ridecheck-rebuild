export const TERMS_VERSION = "v2.0";
export const INSPECTION_SCOPE_VERSION = "scope-v2.0";
export const LEGAL_VERSION = "v2.0-april-2026";
export const EFFECTIVE_DATE = "April 1, 2026";

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

export const LEGAL_DISCLAIMER = `RideCheck provides a visual, non-invasive pre-purchase vehicle inspection and documented observational findings only. This inspection is limited to conditions observable at the time of the inspection and does not constitute a warranty, guarantee, certification, appraisal, or representation of future vehicle condition or performance.

RideCheck does not perform engine teardown, compression testing, internal transmission inspection, frame measurement, underbody structural testing, or any other invasive, destructive, or disassembly-based testing. Hidden, intermittent, concealed, inaccessible, or emerging conditions may not be detected.

Inspection findings may be affected by weather, lighting, vehicle cleanliness, engine temperature, battery state, seller access restrictions, locked compartments, and site conditions. This inspection is not a substitute for a comprehensive mechanical inspection at a licensed repair facility or a dealership diagnostic.

Repair estimates included in any report are informed, non-binding estimates only. Actual repair costs may vary significantly. The final vehicle purchase decision remains solely the responsibility of the buyer. RideCheck is not a party to any vehicle sale transaction.

To the maximum extent permitted by applicable law, RideCheck's total liability for any claim arising from inspection services is limited to the amount paid for the specific inspection service. RideCheck is not liable for vehicle repair costs, diminished value, consequential or incidental damages, lost opportunity, towing, transportation, or any other costs arising after vehicle purchase.`;

export const LEGAL_SUMMARY_BULLETS = [
  "RideCheck is a visual, non-invasive inspection and observational reporting service only.",
  "This inspection is not a warranty, guarantee, or certification of vehicle condition.",
  "Hidden, intermittent, or concealed issues may not be detectable by non-invasive inspection.",
  "Repair estimates are informed and non-binding — actual costs may differ.",
  "The buyer retains full and sole responsibility for the purchase decision.",
  "RideCheck's liability is capped at the amount paid for the inspection service.",
  "This report is for the requesting client only and should not be solely relied upon.",
];
