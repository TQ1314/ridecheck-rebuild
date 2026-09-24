import { describe, expect, it } from "vitest";
import { buildOptionalOrderFields, createOrderSchema } from "../contract";

const baseInput = {
  vehicle_year: 2015,
  vehicle_make: "Toyota",
  vehicle_model: "Camry",
  vehicle_location: "Hoffman Estates, IL",
  buyer_phone: "8475551212",
  booking_type: "self_arrange" as const,
  service_zip: "60169",
};

describe("order-create intake persistence contract", () => {
  it("keeps manual booking valid without provenance", () => {
    const parsed = createOrderSchema.safeParse(baseInput);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = buildOptionalOrderFields(parsed.data, new Set());
    expect(result.error).toBeUndefined();
    expect(result.fields).toEqual({});
  });

  it("persists extracted provenance and buyer-confirmed values", () => {
    const parsed = createOrderSchema.safeParse({
      ...baseInput,
      vin: "1HGCM82633A004352",
      intake_provenance: {
        model: {
          proposal: "Camry",
          source: "booking-intake/550e8400-e29b-41d4-a716-446655440000",
          evidence: "2015 Toyota Camry",
          buyer_final: "Camry",
        },
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = buildOptionalOrderFields(parsed.data, new Set([
      "listing_claimed_vin", "intake_provenance",
    ]));
    expect(result.error).toBeUndefined();
    expect(result.fields.listing_claimed_vin).toBe("1HGCM82633A004352");
    expect(result.fields.intake_provenance).toEqual(parsed.data.intake_provenance);
  });

  it("persists all Buyer Arranged handoff values exactly", () => {
    const parsed = createOrderSchema.safeParse({
      ...baseInput,
      booking_method: "buyer_arranged",
      inspection_address: "123 Main Street, Hoffman Estates, IL",
      inspection_time_window: "Saturday 10am-2pm",
      notes_to_inspector: "Use the north parking lot.",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = buildOptionalOrderFields(parsed.data, new Set([
      "booking_method", "inspection_address", "inspection_time_window",
      "notes_to_inspector",
    ]));
    expect(result.error).toBeUndefined();
    expect(result.fields).toMatchObject({
      booking_method: "buyer_arranged",
      inspection_address: "123 Main Street, Hoffman Estates, IL",
      inspection_time_window: "Saturday 10am-2pm",
      notes_to_inspector: "Use the north parking lot.",
    });
  });

  it("fails closed when Buyer Arranged storage is unavailable", () => {
    const parsed = createOrderSchema.safeParse({
      ...baseInput,
      booking_method: "buyer_arranged",
      inspection_address: "123 Main Street",
      inspection_time_window: "Saturday morning",
      notes_to_inspector: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = buildOptionalOrderFields(parsed.data, new Set());
    expect(result.error?.code).toBe("buyer_arranged_storage_unavailable");
    expect(result.error?.missing_fields).toEqual([
      "inspection_address", "inspection_time_window", "notes_to_inspector",
    ]);
  });

  it("rejects malformed VIN claims", () => {
    const parsed = createOrderSchema.safeParse({ ...baseInput, vin: "not-a-vin" });
    expect(parsed.success).toBe(false);
  });

  it("bounds sensitive provenance references", () => {
    const parsed = createOrderSchema.safeParse({
      ...baseInput,
      intake_provenance: {
        model: {
          proposal: "Camry",
          source: "x".repeat(121),
        },
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts expanded discovery sources independently from seller type", () => {
    for (const listing_source of ["auction", "referral", "offline", "other"] as const) {
      const parsed = createOrderSchema.safeParse({
        ...baseInput,
        listing_source,
        seller_type: "private_party",
      });
      expect(parsed.success).toBe(true);
    }

    const dealershipListing = createOrderSchema.safeParse({
      ...baseInput,
      listing_source: "online_marketplace",
      seller_type: "dealership",
    });
    expect(dealershipListing.success).toBe(true);
  });
});