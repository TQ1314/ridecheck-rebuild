import "server-only";

export type TransferReadinessStatus = "ready" | "caution" | "concern" | "unknown";

export type TitleTransferRiskFlag =
  | "TITLE_NOT_PRESENT"
  | "VIN_TITLE_MISMATCH"
  | "OPEN_TITLE"
  | "SELLER_NAME_UNVERIFIED"
  | "ODOMETER_DISCLOSURE_INCOMPLETE"
  | "LIEN_RELEASE_MISSING"
  | "TITLE_UNSIGNED"
  | "OUT_OF_STATE_TITLE"
  | "BUYER_NAME_NOT_COMPLETED"
  | "UNABLE_TO_VERIFY_DOCUMENTS";

export interface TitleTransferInput {
  title_present:                 boolean | null;
  seller_name_on_title:          string | null;
  buyer_name_completed:          string | null;   // yes | no | not_applicable | unable_to_verify
  odometer_disclosure_completed: string | null;
  lien_release_present:          string | null;
  title_signed:                  string | null;
  open_title:                    string | null;   // yes | no | unable_to_verify
  vin_matches_title:             string | null;   // yes | no | unable_to_verify
  state_of_title:                string | null;
}

export interface TitleTransferResult {
  transferReadinessStatus: TransferReadinessStatus;
  riskFlags:               TitleTransferRiskFlag[];
  summary:                 string;
}

const CONCERN_STATES = ["IL", "WI", "IN", "MI", "IA", "MO"];

export function calculateTransferReadiness(input: TitleTransferInput): TitleTransferResult {
  let status: TransferReadinessStatus = "ready";
  const flags: TitleTransferRiskFlag[] = [];

  function escalateToConcern(flag: TitleTransferRiskFlag) {
    flags.push(flag);
    status = "concern";
  }

  function escalateToCaution(flag: TitleTransferRiskFlag) {
    flags.push(flag);
    if (status === "ready") status = "caution";
  }

  // ── Concern conditions ────────────────────────────────────────────────────
  if (input.title_present === false) {
    escalateToConcern("TITLE_NOT_PRESENT");
  }

  if (input.vin_matches_title === "no") {
    escalateToConcern("VIN_TITLE_MISMATCH");
  }

  if (input.open_title === "yes") {
    escalateToConcern("OPEN_TITLE");
  }

  if (
    input.title_present === true &&
    (!input.seller_name_on_title ||
      input.seller_name_on_title.trim() === "" ||
      input.seller_name_on_title === "unable_to_verify")
  ) {
    escalateToConcern("SELLER_NAME_UNVERIFIED");
  }

  if (
    input.odometer_disclosure_completed === "no"
  ) {
    escalateToConcern("ODOMETER_DISCLOSURE_INCOMPLETE");
  }

  if (input.lien_release_present === "no") {
    escalateToConcern("LIEN_RELEASE_MISSING");
  }

  // ── Caution conditions ────────────────────────────────────────────────────
  if (input.buyer_name_completed === "no") {
    escalateToCaution("BUYER_NAME_NOT_COMPLETED");
  }

  if (input.title_signed === "no") {
    escalateToCaution("TITLE_UNSIGNED");
  }

  const st = input.state_of_title;
  if (st && st !== "unable_to_verify") {
    const isLocal = CONCERN_STATES.includes(st.toUpperCase());
    if (!isLocal && st !== "Other") {
      escalateToCaution("OUT_OF_STATE_TITLE");
    }
    if (st === "Other") {
      escalateToCaution("OUT_OF_STATE_TITLE");
    }
  }

  // Any unable_to_verify ⇒ caution
  const unverifiableFields = [
    input.vin_matches_title,
    input.open_title,
    input.buyer_name_completed,
    input.odometer_disclosure_completed,
    input.lien_release_present,
    input.title_signed,
    input.state_of_title,
  ];
  if (unverifiableFields.some((f) => f === "unable_to_verify")) {
    if (!flags.includes("UNABLE_TO_VERIFY_DOCUMENTS")) {
      escalateToCaution("UNABLE_TO_VERIFY_DOCUMENTS");
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  let summary: string;

  if (flags.length === 0) {
    summary =
      "RideCheck reviewed visible title/transfer indicators at the time of inspection. No concerns identified.";
  } else if ((status as string) === "concern") {
    summary =
      "Transfer concern identified. Buyer should verify title status with the appropriate state motor vehicle authority before completing purchase.";
  } else {
    summary =
      "Minor transfer readiness items noted. Buyer should review the flagged items before completing purchase.";
  }

  return { transferReadinessStatus: status, riskFlags: flags, summary };
}
