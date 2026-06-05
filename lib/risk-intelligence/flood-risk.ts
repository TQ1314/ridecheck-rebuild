import "server-only";
import type { FloodRiskResult, FloodRiskLevel, FloodIndicator } from "./types";

// Maps existing TitleHistoryModule flood_indicators values → risk points
// These are the physical observation fields recorded by the RideChecker.
// Future additions (extended checklist) can be appended here without schema changes.
const FLOOD_MAP: Array<{ key: string; label: string; points: number }> = [
  { key: "mold_odor",             label: "Musty / mold odor detected",                points: 4 },
  { key: "water_staining",        label: "Water stains or tide marks visible",        points: 3 },
  { key: "interior_rust",         label: "Rust / corrosion inside cabin",             points: 4 },
  { key: "mud_silt",              label: "Mud, silt, or sediment deposits",           points: 5 },
  { key: "corroded_wiring",       label: "Corroded wiring or electrical connectors",  points: 5 },
  { key: "fogged_lights",         label: "Moisture / fogging inside headlights",      points: 3 },
  { key: "unusual_interior_rust", label: "Unusual rust on interior metal panels",     points: 3 },
];

// Score → risk level thresholds (per specification)
// 0–10  LOW | 11–25 MODERATE | 26+ HIGH
function toLevel(score: number): FloodRiskLevel {
  if (score >= 26) return "HIGH";
  if (score >= 11) return "MODERATE";
  return "LOW";
}

/**
 * Pure function — no I/O.  Pass TitleHistoryModule.flood_indicators from the
 * RideChecker submission.  "none" is the explicit "no indicators" sentinel.
 */
export function runFloodRisk(
  floodIndicators: string[] | null | undefined,
): FloodRiskResult {
  const active = new Set(floodIndicators ?? []);
  active.delete("none");

  const indicators: FloodIndicator[] = FLOOD_MAP.map((item) => ({
    key:     item.key,
    label:   item.label,
    present: active.has(item.key),
    points:  item.points,
  }));

  const score = indicators.reduce(
    (sum, ind) => sum + (ind.present ? ind.points : 0),
    0,
  );
  const level = toLevel(score);

  return {
    floodRiskScore:   score,
    floodRiskLevel:   level,
    indicators,
    activeIndicators: indicators.filter((i) => i.present).map((i) => i.key),
    findings:         { indicators, score, level },
  };
}
