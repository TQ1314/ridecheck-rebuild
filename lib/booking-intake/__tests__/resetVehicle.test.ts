import { describe, expect, it } from "vitest";
import { clearVehicleAttempt } from "../resetVehicle";

describe("explicit vehicle replacement", () => {
  it("clears all Vehicle A fields but preserves buyer contact details", () => {
    const state: Record<string, unknown> = {
      buyerPhone: "buyer-contact",
      buyerEmailInput: "buyer@example.com",
      vehicleYear: "2015",
      vehicleMake: "Toyota",
      vehicleModel: "Camry",
      vehicleLocation: "Mount Prospect",
      serviceZip: "60056",
      intakeImageIds: ["vehicle-a-image"],
      intakeImageNames: ["vehicle-a.png"],
      intakeProposal: { model: { value: "Camry" } },
      intakeProvenance: { model: { proposal: "Camry" } },
      listingUrl: "https://example.com/vehicle-a",
      classification: { packageTier: "premium" },
      sellerPhone: "seller-contact",
    };
    const keys = [
      "SellerType", "ListingSource", "BookingType", "PlatformSource", "VehicleSeenLocation",
      "VehicleYear", "VehicleMake", "VehicleModel", "VehicleTrim", "VehicleVin",
      "VehicleDescription", "VehicleMileage", "VehiclePrice", "ListingUrl", "VehicleLocation",
      "SellerName", "SellerPhone", "PreferredDate", "InspectionAddress", "InspectionTimeWindow",
      "NotesToInspector", "ServiceZip", "ZipStatus", "Classification", "IntakeUrl",
      "IntakeImageIds", "IntakeImageNames", "IntakeProposal", "IntakeOriginalProposal",
      "IntakeProvenance", "IntakeWarning", "ShowWhyModal", "Step",
    ];
    const setters = Object.fromEntries(keys.map((key) => [
      `set${key}`,
      (value: unknown) => { state[key[0].toLowerCase() + key.slice(1)] = value; },
    ]));

    clearVehicleAttempt(setters as Parameters<typeof clearVehicleAttempt>[0]);

    expect(state).toMatchObject({
      vehicleYear: "", vehicleMake: "", vehicleModel: "",
      vehicleLocation: "", serviceZip: "", zipStatus: "idle",
      listingUrl: "", sellerPhone: "", classification: null,
      intakeImageIds: [], intakeImageNames: [], intakeProposal: null,
      intakeOriginalProposal: null, intakeProvenance: {}, step: 0,
      buyerPhone: "buyer-contact", buyerEmailInput: "buyer@example.com",
    });
    expect(keys.map((key) => key[0].toLowerCase() + key.slice(1)))
      .not.toContain("buyerPhone");
    // The required vehicle fields are empty; Vehicle A cannot be submitted as B.
    expect(Boolean(state.vehicleYear && state.vehicleMake && state.vehicleModel && state.vehicleLocation && state.serviceZip)).toBe(false);
  });
});