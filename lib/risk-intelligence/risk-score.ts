import "server-only";
import type { RiskLevel, RiskScoreInput, RiskScoreOutput } from "./types";

function toLevel(score: number): RiskLevel {
  if (score >= 50) return "HIGH";
  if (score >= 30) return "ELEVATED";
  if (score >= 15) return "MODERATE";
  return "LOW";
}

export function computeRiskScore(input: RiskScoreInput): RiskScoreOutput {
  let score = 0;
  const reasons: string[]   = [];
  const hardStops: string[] = [];

  // ── VIN ────────────────────────────────────────────────────────────────────
  if (!input.vinResult.vinValid) {
    score += 20;
    reasons.push("VIN could not be validated by NHTSA vPIC");
  }

  if (input.vinMismatch) {
    score += 25;
    reasons.push("VIN mismatch: buyer-provided VIN does not match physically-scanned VIN");
    hardStops.push("VIN mismatch detected");
  }

  // ── Recalls ────────────────────────────────────────────────────────────────
  const highRecalls   = input.recallResult.recalls.filter((r) => r.severity === "HIGH");
  const medRecalls    = input.recallResult.recalls.filter((r) => r.severity === "MEDIUM");
  const lowRecalls    = input.recallResult.recalls.filter((r) => r.severity === "LOW");

  score += highRecalls.length * 20;
  score += medRecalls.length  * 10;
  score += lowRecalls.length  * 5;

  if (highRecalls.length > 0) {
    const components = highRecalls.map((r) => r.component).join(", ");
    reasons.push(
      `${highRecalls.length} high-severity recall(s) — ${components}`,
    );
    if (input.hasOBDSafetyCodes) {
      hardStops.push("High recall severity combined with active OBD safety codes");
    }
  }
  if (medRecalls.length > 0) reasons.push(`${medRecalls.length} medium-severity recall(s)`);
  if (lowRecalls.length  > 0) reasons.push(`${lowRecalls.length} low-severity recall(s)`);
  if (input.recallResult.error) reasons.push("Recall lookup encountered an error — verify manually");

  // ── Flood ──────────────────────────────────────────────────────────────────
  score += input.floodResult.floodRiskScore;

  if (input.floodResult.floodRiskLevel === "HIGH") {
    reasons.push(
      `High flood risk — ${input.floodResult.activeIndicators.length} flood indicator(s) observed`,
    );
    hardStops.push("High flood risk indicators present");
  } else if (input.floodResult.floodRiskLevel === "MODERATE") {
    reasons.push(
      `Moderate flood risk — ${input.floodResult.activeIndicators.length} indicator(s) noted`,
    );
  }

  // ── Theft ──────────────────────────────────────────────────────────────────
  if (input.theftResult.status === "FLAGGED") {
    score += 30;
    reasons.push("Vehicle flagged in theft / salvage database");
    hardStops.push("Flagged theft or salvage record");
  } else if (input.theftResult.status === "UNABLE_TO_VERIFY") {
    score += 5;
    reasons.push("Theft / salvage status could not be verified — manual NICB check recommended");
  }

  // ── Market Value ───────────────────────────────────────────────────────────
  const mvRisk = input.marketValueResult.pricingRiskLevel;
  const mvPct  = input.marketValueResult.variancePercent;

  if (mvRisk === "HIGH_RISK") {
    score += 20;
    reasons.push(
      `Listing price is ~${mvPct ?? "?"}% below estimated market value — possible hidden risk`,
    );
  } else if (mvRisk === "MODERATE_RISK") {
    score += 10;
    reasons.push(`Listing price is ~${mvPct ?? "?"}% below estimated market value`);
  } else if (mvRisk === "LOW_RISK") {
    score += 5;
    reasons.push("Listing price is moderately below estimated market value");
  }

  // ── Title & Transfer Readiness ────────────────────────────────────────────
  if (input.titleTransfer) {
    const tt = input.titleTransfer;

    if (tt.transferReadinessStatus === "concern") {
      score += 20;
      const concernFlags = tt.riskFlags.filter((f) =>
        ["VIN_TITLE_MISMATCH", "OPEN_TITLE", "TITLE_NOT_PRESENT", "LIEN_RELEASE_MISSING"].includes(f)
      );
      reasons.push(
        `Title & Transfer concern — ${tt.riskFlags.slice(0, 3).join(", ")}${tt.riskFlags.length > 3 ? "…" : ""}`,
      );
      if (concernFlags.includes("VIN_TITLE_MISMATCH")) {
        hardStops.push("VIN does not match title documentation");
      }
      if (concernFlags.includes("OPEN_TITLE")) {
        hardStops.push("Open title detected — prior ownership chain may be incomplete");
      }
      if (concernFlags.includes("TITLE_NOT_PRESENT")) {
        hardStops.push("Title not present at time of inspection");
      }
      if (concernFlags.includes("LIEN_RELEASE_MISSING")) {
        hardStops.push("Lien indicated but release not present");
      }
    } else if (tt.transferReadinessStatus === "caution") {
      score += 8;
      reasons.push(
        `Title & Transfer caution — ${tt.riskFlags.slice(0, 3).join(", ")}${tt.riskFlags.length > 3 ? "…" : ""}`,
      );
    }
  }

  let level = toLevel(score);

  // Hard-stop escalation: title concern forces at least ELEVATED
  if (
    input.titleTransfer &&
    ["VIN_TITLE_MISMATCH", "OPEN_TITLE", "TITLE_NOT_PRESENT", "LIEN_RELEASE_MISSING"].some((f) =>
      input.titleTransfer!.riskFlags.includes(f)
    ) &&
    (level === "LOW" || level === "MODERATE")
  ) {
    level = "ELEVATED";
  }

  // Hard-stop escalation: add hard stops for combined HIGH + flood
  if (level === "HIGH" && input.floodResult.floodRiskLevel === "HIGH" && highRecalls.length > 0) {
    hardStops.push("Combined high flood risk and high-severity safety recalls");
  }

  return { score, level, reasons, hardStops };
}
