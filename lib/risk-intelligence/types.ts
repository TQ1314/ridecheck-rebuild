export type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
export type FloodRiskLevel = "LOW" | "MODERATE" | "HIGH";
export type RecallSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH";
export type TheftStatus = "CLEAR" | "FLAGGED" | "UNABLE_TO_VERIFY";

// ── VIN Decode ──────────────────────────────────────────────────────────────
export interface VinDecodeResult {
  vin: string;
  vinValid: boolean;
  year: string | null;
  make: string | null;
  model: string | null;
  source: string;
  rawResponse?: unknown;
  error?: string;
}

// ── Recall Check ────────────────────────────────────────────────────────────
export interface RecallItem {
  component: string;
  summary: string;
  consequence: string | null;
  remedy: string | null;
  reportReceived: string | null;
  nhtsaCampaignNumber: string | null;
  severity: RecallSeverity;
}

export interface RecallCheckResult {
  vin: string;
  recallCount: number;
  recalls: RecallItem[];
  highestSeverity: RecallSeverity;
  source: string;
  error?: string;
}

// ── Flood Risk ──────────────────────────────────────────────────────────────
export interface FloodIndicator {
  key: string;
  label: string;
  present: boolean;
  points: number;
}

export interface FloodRiskResult {
  floodRiskScore: number;
  floodRiskLevel: FloodRiskLevel;
  indicators: FloodIndicator[];
  activeIndicators: string[];
  findings: unknown;
}

// ── Theft / Salvage ─────────────────────────────────────────────────────────
export interface TheftCheckResult {
  status: TheftStatus;
  source: string;
  findings: unknown;
  error?: string;
}

// ── Market Value ─────────────────────────────────────────────────────────────
export type PricingRiskLevel =
  | "NONE"
  | "LOW_RISK"
  | "MODERATE_RISK"
  | "HIGH_RISK"
  | "UNAVAILABLE";

export interface MarketValueResult {
  listingPrice: number | null;
  estimatedMarketValue: number | null;
  variancePercent: number | null;
  pricingRiskLevel: PricingRiskLevel;
  source: string;
  error?: string;
}

// ── Title Transfer ──────────────────────────────────────────────────────────
export type TransferReadinessStatus = "ready" | "caution" | "concern" | "unknown";

export interface TitleTransferRiskInput {
  transferReadinessStatus: TransferReadinessStatus;
  riskFlags: string[];
}

// ── Risk Score ───────────────────────────────────────────────────────────────
export interface RiskScoreInput {
  vinResult: VinDecodeResult;
  recallResult: RecallCheckResult;
  floodResult: FloodRiskResult;
  theftResult: TheftCheckResult;
  marketValueResult: MarketValueResult;
  vinMismatch?: boolean;
  hasOBDSafetyCodes?: boolean;
  titleTransfer?: TitleTransferRiskInput;
}

export interface RiskScoreOutput {
  score: number;
  level: RiskLevel;
  reasons: string[];
  hardStops: string[];
}

// ── Runner Output ────────────────────────────────────────────────────────────
export interface RiskIntelligenceRunResult {
  orderId: string;
  riskCheckId: string;
  vin: string | null;
  overallScore: number;
  overallLevel: RiskLevel;
  reasons: string[];
  hardStops: string[];
  vin_check: VinDecodeResult;
  recall_check: RecallCheckResult;
  flood_check: FloodRiskResult;
  theft_check: TheftCheckResult;
  market_check: MarketValueResult;
  completed_at: string;
}
