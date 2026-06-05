import "server-only";
import type { VinDecodeResult } from "./types";

const NHTSA_VIN_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

export async function runVinDecode(vin: string): Promise<VinDecodeResult> {
  const clean = (vin || "").trim().toUpperCase();

  if (!clean || clean.length !== 17) {
    return {
      vin: clean,
      vinValid: false,
      year: null,
      make: null,
      model: null,
      source: "nhtsa_vpic",
      error: "VIN must be exactly 17 characters",
    };
  }

  try {
    const res = await fetch(`${NHTSA_VIN_BASE}/${clean}?format=json`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return {
        vin: clean,
        vinValid: false,
        year: null,
        make: null,
        model: null,
        source: "nhtsa_vpic",
        error: `NHTSA vPIC returned HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const r = (data?.Results?.[0] ?? {}) as Record<string, string>;

    const errorCode = String(r.ErrorCode ?? "");
    const vinValid  = errorCode === "0" || errorCode.startsWith("0 ");
    const year      = r.ModelYear || null;
    const make      = r.Make      || null;
    const model     = r.Model     || null;

    return {
      vin: clean,
      vinValid,
      year,
      make,
      model,
      source: "nhtsa_vpic",
      rawResponse: r,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      vin: clean,
      vinValid: false,
      year: null,
      make: null,
      model: null,
      source: "nhtsa_vpic",
      error: msg,
    };
  }
}
