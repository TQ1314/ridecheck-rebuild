import { LAKE_COUNTY_ZIPS, MCHENRY_COUNTY_ZIPS, COOK_COUNTY_ZIPS } from "./lakeCountyZips";

export type ServiceCounty = "lake" | "mchenry" | "cook" | "unknown";

export interface ServiceAreaResult {
  state: "IL";
  county: ServiceCounty;
  isAllowed: boolean;
}

export const PILOT_CONFIG = {
  enabled: true,
  lake_cap: 50,
  mchenry_cap: 50,
  pilot_total_cap: 200,
} as const;

const lakeSet = new Set(LAKE_COUNTY_ZIPS);
const mchenrySet = new Set(MCHENRY_COUNTY_ZIPS);
const cookSet = new Set(COOK_COUNTY_ZIPS);

export function resolveCounty(zip: string): ServiceCounty {
  if (lakeSet.has(zip)) return "lake";
  if (mchenrySet.has(zip)) return "mchenry";
  if (cookSet.has(zip)) return "cook";
  return "unknown";
}

export function getServiceAreaFromZip(zip: string): ServiceAreaResult {
  const county = resolveCounty(zip);
  const isAllowed = county === "lake";
  return { state: "IL", county, isAllowed };
}

export interface PilotPhaseResult {
  allowed: boolean;
  allowedCounties: ServiceCounty[];
  currentPhase: "lake" | "mchenry" | "cook" | "full";
  error?: string;
  unlocks_after_total_orders?: number;
}

export function checkPilotPhase(
  county: ServiceCounty,
  totalOrders: number,
  countsByCounty: Record<string, number>
): PilotPhaseResult {
  const { lake_cap, mchenry_cap, pilot_total_cap } = PILOT_CONFIG;
  const lake_unlock_end = lake_cap;
  const mchenry_unlock_end = lake_cap + mchenry_cap;

  if (totalOrders >= pilot_total_cap) {
    return {
      allowed: false,
      allowedCounties: [],
      currentPhase: "full",
      error: "pilot_capacity_reached",
    };
  }

  let allowedCounties: ServiceCounty[];
  let currentPhase: "lake" | "mchenry" | "cook";

  if (totalOrders < lake_unlock_end) {
    allowedCounties = ["lake"];
    currentPhase = "lake";
  } else if (totalOrders < mchenry_unlock_end) {
    allowedCounties = ["lake", "mchenry"];
    currentPhase = "mchenry";
  } else {
    allowedCounties = ["lake", "mchenry", "cook"];
    currentPhase = "cook";
  }

  if (county === "unknown" || !allowedCounties.includes(county)) {
    let unlocks_after: number | undefined;
    if (county === "mchenry") unlocks_after = lake_unlock_end;
    else if (county === "cook") unlocks_after = mchenry_unlock_end;

    return {
      allowed: false,
      allowedCounties,
      currentPhase,
      error: "county_locked",
      unlocks_after_total_orders: unlocks_after,
    };
  }

  const countyCount = countsByCounty[county] || 0;
  let countyCap: number;
  if (county === "lake") countyCap = lake_cap;
  else if (county === "mchenry") countyCap = mchenry_cap;
  else countyCap = pilot_total_cap - lake_cap - mchenry_cap;

  if (countyCount >= countyCap) {
    return {
      allowed: false,
      allowedCounties,
      currentPhase,
      error: "county_cap_reached",
    };
  }

  return {
    allowed: true,
    allowedCounties,
    currentPhase,
  };
}
