import "server-only";
import type { MarketValueResult, PricingRiskLevel } from "./types";

export interface MarketValueParams {
  year: string;
  make: string;
  model: string;
  mileage?: number;
  listingPrice?: number;
}

// ── Provider abstraction ─────────────────────────────────────────────────────
// Swap `activeProvider` for BlackBook, MarketCheck, CarsXE, or any other
// valuations API without changing any call-sites.

export interface MarketValueProvider {
  readonly name: string;
  estimate(params: MarketValueParams): Promise<MarketValueResult>;
}

// ── Shared variance helper (used by runner after obtaining estimate) ──────────
export function calcVariance(
  listingPrice: number,
  estimatedValue: number,
): { variancePercent: number; pricingRiskLevel: PricingRiskLevel } {
  if (!listingPrice || !estimatedValue) {
    return { variancePercent: 0, pricingRiskLevel: "UNAVAILABLE" };
  }
  // Positive variance = listing is below market (risk signal)
  const pct = ((estimatedValue - listingPrice) / estimatedValue) * 100;
  const rounded = Math.round(pct * 10) / 10;

  let level: PricingRiskLevel = "NONE";
  if (pct >= 30)      level = "HIGH_RISK";
  else if (pct >= 20) level = "MODERATE_RISK";
  else if (pct >= 10) level = "LOW_RISK";

  return { variancePercent: rounded, pricingRiskLevel: level };
}

// ── Built-in: no provider configured ─────────────────────────────────────────
class NoProviderMarketValue implements MarketValueProvider {
  readonly name = "no_provider_configured";

  async estimate(params: MarketValueParams): Promise<MarketValueResult> {
    return {
      listingPrice:          params.listingPrice ?? null,
      estimatedMarketValue:  null,
      variancePercent:       null,
      pricingRiskLevel:      "UNAVAILABLE",
      source:                this.name,
    };
  }
}

// ── Registry — replace with real provider when ready ─────────────────────────
// Example:
//   import { BlackBookProvider } from "./providers/blackbook";
//   const activeProvider: MarketValueProvider = new BlackBookProvider(process.env.BLACKBOOK_API_KEY!);
const activeProvider: MarketValueProvider = new NoProviderMarketValue();

export async function runMarketValueCheck(params: MarketValueParams): Promise<MarketValueResult> {
  try {
    const result = await activeProvider.estimate(params);

    // If provider returned an estimate, recalculate variance with shared logic
    if (result.estimatedMarketValue != null && result.listingPrice != null) {
      const { variancePercent, pricingRiskLevel } = calcVariance(
        result.listingPrice,
        result.estimatedMarketValue,
      );
      return { ...result, variancePercent, pricingRiskLevel };
    }
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Provider error";
    return {
      listingPrice:         params.listingPrice ?? null,
      estimatedMarketValue: null,
      variancePercent:      null,
      pricingRiskLevel:     "UNAVAILABLE",
      source:               activeProvider.name,
      error:                msg,
    };
  }
}
