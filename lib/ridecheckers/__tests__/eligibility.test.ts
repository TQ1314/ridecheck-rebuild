import { describe, expect, it } from "vitest";
import { getRideCheckerAssignmentEligibility } from "../eligibility";

const base = {
  role: "ridechecker_active",
  is_active: true,
  workflow_stage: "active",
  availability_status: "available",
  service_radius_miles: 10,
  agreement_status: "signed",
  current_agreement_version: "RCCPA_v1_2026_06",
  latitude: 37.7749,
  longitude: -122.4194,
};

describe("canonical RideChecker assignment eligibility", () => {
  it("allows an available approved checker with a pending background check", () => {
    expect(getRideCheckerAssignmentEligibility({
      ...base, background_check_status: "pending",
    }, { order: { latitude: 37.775, longitude: -122.419 } }).eligible).toBe(true);
  });

  it("blocks unavailable and unsigned checkers", () => {
    const result = getRideCheckerAssignmentEligibility({
      ...base, availability_status: "unavailable", agreement_status: "not_signed",
    });
    expect(result.eligible).toBe(false);
    expect(result.blockedReasons).toEqual(expect.arrayContaining([
      "RideChecker is not available",
      "Contractor agreement is not signed",
    ]));
  });

  it("blocks outside-radius work unless an explicit override is supplied", () => {
    const order = { latitude: 40.7128, longitude: -74.006 };
    expect(getRideCheckerAssignmentEligibility(base, { order }).eligible).toBe(false);
    expect(getRideCheckerAssignmentEligibility(base, { order, radiusOverride: true }).eligible).toBe(true);
  });

  it("fails closed when a configured radius cannot be verified", () => {
    const result = getRideCheckerAssignmentEligibility(base);
    expect(result.eligible).toBe(false);
    expect(result.blockedReasons).toContain(
      "Cannot verify service radius: RideChecker and order locations are required",
    );
    expect(getRideCheckerAssignmentEligibility(base, { radiusOverride: true }).eligible).toBe(true);
  });

  it("blocks non-RideChecker profiles even when other fields pass", () => {
    const result = getRideCheckerAssignmentEligibility({ ...base, role: "admin" }, {
      order: { latitude: 37.775, longitude: -122.419 },
    });
    expect(result.blockedReasons).toContain("Profile is not a RideChecker");
  });
});