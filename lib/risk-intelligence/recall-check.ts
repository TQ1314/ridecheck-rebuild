import "server-only";
import type { RecallCheckResult, RecallItem, RecallSeverity } from "./types";

const NHTSA_RECALLS_BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";

// Keyword lists for severity classification
const HIGH_KEYWORDS  = [
  "airbag", "air bag", "brake", "braking",
  "steering", "fuel leak", "fire risk", "fire hazard",
  "rollover", "engine stall", "stall",
];
const MED_KEYWORDS   = [
  "seatbelt", "seat belt", "suspension",
  "electrical", "wiring", "battery",
  "transmission", "acceleration",
];

function classifySeverity(component: string, summary: string): RecallSeverity {
  const text = `${component} ${summary}`.toLowerCase();
  if (HIGH_KEYWORDS.some((kw) => text.includes(kw))) return "HIGH";
  if (MED_KEYWORDS.some((kw)  => text.includes(kw))) return "MEDIUM";
  return "LOW";
}

function highestOf(items: RecallItem[]): RecallSeverity {
  if (items.some((r) => r.severity === "HIGH"))   return "HIGH";
  if (items.some((r) => r.severity === "MEDIUM")) return "MEDIUM";
  if (items.length > 0)                           return "LOW";
  return "NONE";
}

export async function runRecallCheck(
  vin: string,
  make: string,
  model: string,
  year: string,
): Promise<RecallCheckResult> {
  if (!make || !model || !year) {
    return {
      vin,
      recallCount: 0,
      recalls: [],
      highestSeverity: "NONE",
      source: "nhtsa_recalls",
      error: "Insufficient vehicle data — VIN decode required first",
    };
  }

  try {
    const params = new URLSearchParams({ make, model, modelYear: year });
    const res = await fetch(`${NHTSA_RECALLS_BASE}?${params}`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return {
        vin,
        recallCount: 0,
        recalls: [],
        highestSeverity: "NONE",
        source: "nhtsa_recalls",
        error: `NHTSA Recalls API returned HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const raw  = (data?.results ?? []) as Record<string, string>[];

    const recalls: RecallItem[] = raw.map((r) => {
      const component = r.Component   ?? "";
      const summary   = r.Summary     ?? "";
      return {
        component,
        summary,
        consequence:         r.Consequence          ?? null,
        remedy:              r.Remedy               ?? null,
        reportReceived:      r.ReportReceivedDate   ?? null,
        nhtsaCampaignNumber: r.NHTSACampaignNumber  ?? null,
        severity: classifySeverity(component, summary),
      };
    });

    return {
      vin,
      recallCount: recalls.length,
      recalls,
      highestSeverity: highestOf(recalls),
      source: "nhtsa_recalls",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      vin,
      recallCount: 0,
      recalls: [],
      highestSeverity: "NONE",
      source: "nhtsa_recalls",
      error: msg,
    };
  }
}
