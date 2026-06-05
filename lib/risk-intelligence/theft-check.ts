import "server-only";
import type { TheftCheckResult, TheftStatus } from "./types";

// ── Provider abstraction ─────────────────────────────────────────────────────
// Swap `activeProvider` for NICB, NMVTIS, or a commercial provider
// (AutoCheck, CarFax, etc.) without changing any call-sites.

export interface TheftProvider {
  readonly name: string;
  check(vin: string): Promise<TheftCheckResult>;
}

// ── Built-in: no provider configured ────────────────────────────────────────
class NoProviderTheft implements TheftProvider {
  readonly name = "no_provider_configured";

  async check(vin: string): Promise<TheftCheckResult> {
    return {
      status:   "UNABLE_TO_VERIFY",
      source:   this.name,
      findings: {
        message: "No theft/salvage database provider is configured. Manual NICB VINCheck or NMVTIS lookup recommended.",
        vin,
        providers_available: ["NICB VINCheck (nicb.org/vincheck)", "NMVTIS", "AutoCheck", "CarFax"],
      },
    };
  }
}

// ── Registry — replace with real provider when ready ────────────────────────
// Example:
//   import { NicbProvider } from "./providers/nicb";
//   const activeProvider: TheftProvider = new NicbProvider(process.env.NICB_API_KEY!);
const activeProvider: TheftProvider = new NoProviderTheft();

export async function runTheftCheck(vin: string): Promise<TheftCheckResult> {
  if (!vin || vin.length !== 17) {
    return {
      status:   "UNABLE_TO_VERIFY",
      source:   activeProvider.name,
      findings: { message: "Invalid or missing VIN", vin },
    };
  }

  try {
    return await activeProvider.check(vin);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Provider error";
    return {
      status:   "UNABLE_TO_VERIFY",
      source:   activeProvider.name,
      findings: null,
      error:    msg,
    };
  }
}
