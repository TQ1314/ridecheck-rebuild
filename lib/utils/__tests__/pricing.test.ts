import { describe, it, expect } from "vitest";
import {
  getPrice,
  getPriceCents,
  getPackageTier,
  detectListingPlatform,
} from "../pricing";

describe("getPrice", () => {
  it("returns correct standard price", () => {
    const result = getPrice("standard", "concierge");
    expect(result.basePrice).toBe(139);
    expect(result.finalPrice).toBe(139);
    expect(result.discountAmount).toBe(0);
  });

  it("returns same price for self_arrange (no discount)", () => {
    const result = getPrice("standard", "self_arrange");
    expect(result.basePrice).toBe(139);
    expect(result.finalPrice).toBe(139);
    expect(result.discountAmount).toBe(0);
  });

  it("returns correct plus price", () => {
    const result = getPrice("plus", "concierge");
    expect(result.basePrice).toBe(169);
    expect(result.finalPrice).toBe(169);
    expect(result.discountAmount).toBe(0);
  });

  it("returns correct premium price", () => {
    const result = getPrice("premium", "concierge");
    expect(result.basePrice).toBe(189);
    expect(result.finalPrice).toBe(189);
    expect(result.discountAmount).toBe(0);
  });

  it("returns correct exotic price", () => {
    const result = getPrice("exotic", "concierge");
    expect(result.basePrice).toBe(299);
    expect(result.finalPrice).toBe(299);
    expect(result.discountAmount).toBe(0);
  });
});

describe("getPriceCents", () => {
  it("returns price in cents for standard", () => {
    expect(getPriceCents("standard", "concierge")).toBe(13900);
  });

  it("returns price in cents for plus", () => {
    expect(getPriceCents("plus", "concierge")).toBe(16900);
  });

  it("returns price in cents for premium", () => {
    expect(getPriceCents("premium", "concierge")).toBe(18900);
  });
});

describe("getPackageTier", () => {
  it("returns standard for common makes", () => {
    expect(getPackageTier({ make: "Toyota", model: "Camry" })).toBe("standard");
    expect(getPackageTier({ make: "Honda", model: "Civic" })).toBe("standard");
    expect(getPackageTier({ make: "Ford", model: "F-150" })).toBe("standard");
  });

  it("returns premium for Mercedes-Benz", () => {
    expect(getPackageTier({ make: "Mercedes-Benz", model: "GLE" })).toBe("premium");
  });

  it("returns premium for BMW", () => {
    expect(getPackageTier({ make: "BMW", model: "X5" })).toBe("premium");
  });

  it("returns premium for Tesla (luxury brand)", () => {
    expect(getPackageTier({ make: "Tesla", model: "Model 3" })).toBe("premium");
  });

  it("returns plus for heavy duty trucks", () => {
    expect(getPackageTier({ make: "Ford", model: "F-350" })).toBe("plus");
    expect(getPackageTier({ make: "Ram", model: "2500" })).toBe("plus");
  });

  it("returns exotic for exotic makes", () => {
    expect(getPackageTier({ make: "Ferrari", model: "488" })).toBe("exotic");
    expect(getPackageTier({ make: "Lamborghini", model: "Huracan" })).toBe("exotic");
    expect(getPackageTier({ make: "Rolls-Royce", model: "Ghost" })).toBe("exotic");
  });

  it("returns standard when make/model are empty", () => {
    expect(getPackageTier({})).toBe("standard");
    expect(getPackageTier({ make: "", model: "" })).toBe("standard");
  });

  it("returns premium for flagship keywords", () => {
    expect(getPackageTier({ make: "Cadillac", model: "Escalade" })).toBe("premium");
    expect(getPackageTier({ make: "Lincoln", model: "Navigator" })).toBe("premium");
  });

  it("returns plus for 3-row SUVs", () => {
    expect(getPackageTier({ make: "Toyota", model: "Highlander" })).toBe("plus");
    expect(getPackageTier({ make: "Honda", model: "Pilot" })).toBe("plus");
    expect(getPackageTier({ make: "Chevrolet", model: "Tahoe" })).toBe("plus");
  });
});

describe("detectListingPlatform", () => {
  it("detects facebook marketplace", () => {
    expect(detectListingPlatform("https://www.facebook.com/marketplace/item/123")).toBe("facebook");
  });

  it("detects craigslist", () => {
    expect(detectListingPlatform("https://sfbay.craigslist.org/sfc/cto/d/test/123.html")).toBe("craigslist");
  });

  it("returns other for unknown domains", () => {
    expect(detectListingPlatform("https://www.autotrader.com/cars/123")).toBe("other");
  });

  it("returns null for empty strings", () => {
    expect(detectListingPlatform("")).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(detectListingPlatform("not-a-url")).toBeNull();
  });
});
