import { describe, it, expect } from "vitest";
import {
  getPrice,
  getPriceCents,
  getPackageTier,
  detectListingPlatform,
} from "../pricing";

describe("getPrice", () => {
  it("returns correct standard concierge price", () => {
    const result = getPrice("standard", "concierge");
    expect(result.basePrice).toBe(119);
    expect(result.finalPrice).toBe(119);
    expect(result.discountAmount).toBe(0);
  });

  it("returns correct standard self_arrange price with 5% discount", () => {
    const result = getPrice("standard", "self_arrange");
    expect(result.basePrice).toBe(119);
    expect(result.finalPrice).toBe(113);
    expect(result.discountAmount).toBe(6);
  });

  it("returns correct standard buyer_arranged price (same as self_arrange)", () => {
    const result = getPrice("standard", "buyer_arranged");
    expect(result.basePrice).toBe(119);
    expect(result.finalPrice).toBe(113);
    expect(result.discountAmount).toBe(6);
  });

  it("returns correct plus concierge price", () => {
    const result = getPrice("plus", "concierge");
    expect(result.basePrice).toBe(149);
    expect(result.finalPrice).toBe(149);
    expect(result.discountAmount).toBe(0);
  });

  it("returns correct plus buyer_arranged price", () => {
    const result = getPrice("plus", "buyer_arranged");
    expect(result.basePrice).toBe(149);
    expect(result.finalPrice).toBe(142);
    expect(result.discountAmount).toBe(7);
  });

  it("returns correct comprehensive concierge price", () => {
    const result = getPrice("comprehensive", "concierge");
    expect(result.basePrice).toBe(299);
    expect(result.finalPrice).toBe(299);
    expect(result.discountAmount).toBe(0);
  });

  it("returns correct comprehensive buyer_arranged price", () => {
    const result = getPrice("comprehensive", "buyer_arranged");
    expect(result.basePrice).toBe(299);
    expect(result.finalPrice).toBe(284);
    expect(result.discountAmount).toBe(15);
  });
});

describe("getPriceCents", () => {
  it("returns price in cents for standard concierge", () => {
    expect(getPriceCents("standard", "concierge")).toBe(11900);
  });

  it("returns discounted cents for plus buyer_arranged", () => {
    expect(getPriceCents("plus", "buyer_arranged")).toBe(14200);
  });

  it("returns cents for premium concierge", () => {
    expect(getPriceCents("premium", "concierge")).toBe(17900);
  });
});

describe("getPackageTier", () => {
  it("returns standard for common makes", () => {
    expect(getPackageTier({ make: "Toyota", model: "Camry" })).toBe("standard");
    expect(getPackageTier({ make: "Honda", model: "Civic" })).toBe("standard");
    expect(getPackageTier({ make: "Ford", model: "F-150" })).toBe("standard");
  });

  it("returns plus for Mercedes-Benz GLE", () => {
    expect(getPackageTier({ make: "Mercedes-Benz", model: "GLE" })).toBe("plus");
  });

  it("returns plus for BMW", () => {
    expect(getPackageTier({ make: "BMW", model: "X5" })).toBe("plus");
  });

  it("returns plus for Tesla", () => {
    expect(getPackageTier({ make: "Tesla", model: "Model 3" })).toBe("plus");
  });

  it("returns plus for heavy duty trucks", () => {
    expect(getPackageTier({ make: "Ford", model: "F-350" })).toBe("plus");
    expect(getPackageTier({ make: "Ram", model: "2500" })).toBe("plus");
  });

  it("returns premium for exotic makes", () => {
    expect(getPackageTier({ make: "Ferrari", model: "488" })).toBe("premium");
    expect(getPackageTier({ make: "Lamborghini", model: "Huracan" })).toBe("premium");
    expect(getPackageTier({ make: "Rolls-Royce", model: "Ghost" })).toBe("premium");
  });

  it("returns standard when make/model are empty", () => {
    expect(getPackageTier({})).toBe("standard");
    expect(getPackageTier({ make: "", model: "" })).toBe("standard");
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
