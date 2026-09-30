import { describe, it, expect } from "vitest";
import {
  getPrice,
  getPriceCents,
  getPackageTier,
  detectListingPlatform,
} from "../pricing";
import { classifyVehicle } from "../../vehicleClassification";

describe("getPrice", () => {
  it("returns correct standard price", () => {
    const result = getPrice("standard", "concierge");
    expect(result.basePrice).toBe(139);
    expect(result.finalPrice).toBe(139);
    expect(result.discountAmount).toBe(0);
  });

  it("applies the advertised $10 self-arrange discount", () => {
    const result = getPrice("standard", "self_arrange");
    expect(result.basePrice).toBe(139);
    expect(result.finalPrice).toBe(129);
    expect(result.discountAmount).toBe(10);
  });

  it("returns correct plus price", () => {
    const result = getPrice("plus", "concierge");
    expect(result.basePrice).toBe(169);
    expect(result.finalPrice).toBe(169);
    expect(result.discountAmount).toBe(0);
  });

  it("keeps legacy premium records priced as Plus, not a separate $189 tier", () => {
    const result = getPrice("premium", "concierge");
    expect(result.basePrice).toBe(169);
    expect(result.finalPrice).toBe(169);
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

  it("returns Plus cents for the legacy premium alias", () => {
    expect(getPriceCents("premium", "concierge")).toBe(16900);
  });
});

describe("getPackageTier", () => {
  it("returns standard for common makes", () => {
    expect(getPackageTier({ make: "Toyota", model: "Camry" })).toBe("standard");
    expect(getPackageTier({ make: "Honda", model: "Civic" })).toBe("standard");
    expect(getPackageTier({ make: "Ford", model: "F-150" })).toBe("standard");
  });

  it("returns plus for ordinary Mercedes-Benz", () => {
    expect(getPackageTier({ make: "Mercedes-Benz", model: "GLE" })).toBe("plus");
  });

  it("returns plus for ordinary BMW", () => {
    expect(getPackageTier({ make: "BMW", model: "X5" })).toBe("plus");
  });

  it("returns plus for Tesla as an EV", () => {
    expect(getPackageTier({ make: "Tesla", model: "Model 3" })).toBe("plus");
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

  it("does not price flagships as performance merely for being flagships", () => {
    expect(getPackageTier({ make: "Cadillac", model: "Escalade" })).toBe("standard");
    expect(getPackageTier({ make: "Lincoln", model: "Navigator" })).toBe("standard");
  });

  it("returns standard for gasoline 3-row SUVs without other qualifying signals", () => {
    expect(getPackageTier({ make: "Toyota", model: "Highlander" })).toBe("standard");
    expect(getPackageTier({ make: "Honda", model: "Pilot" })).toBe("standard");
    expect(getPackageTier({ make: "Chevrolet", model: "Tahoe" })).toBe("standard");
  });
});

describe("three-tier vehicle policy", () => {
  const vehicle = (make: string, model: string, extras: Partial<Parameters<typeof classifyVehicle>[0]> = {}) =>
    classifyVehicle({ make, model, year: 2010, ...extras });

  it("does not elevate an ordinary expensive gasoline vehicle", () => {
    expect(vehicle("Toyota", "Highlander", { askingPrice: 75000 }).packageTier).toBe("standard");
    expect(vehicle("Cadillac", "Escalade", { askingPrice: 120000 }).packageTier).toBe("standard");
  });

  it("keeps European and EV vehicles Plus regardless of age, mileage or low price", () => {
    expect(vehicle("BMW", "X5", { mileage: 200000, askingPrice: 5000 }).packageTier).toBe("plus");
    expect(vehicle("Tesla", "Model 3", { mileage: 200000, askingPrice: 5000 }).packageTier).toBe("plus");
    expect(vehicle("Volkswagen", "Jetta").packageTier).toBe("plus");
    expect(vehicle("MINI", "Cooper").packageTier).toBe("plus");
    expect(vehicle("Mercedes-Benz", "S580").packageTier).toBe("plus");
    expect(vehicle("Mercedes-Benz", "Maybach S580").packageTier).toBe("plus");
    expect(vehicle("Lexus", "RX", { fuelType: "gasoline" }).packageTier).toBe("standard");
  });

  it("uses explicit fuel when a name alone cannot identify diesel, hybrid or EV", () => {
    for (const fuelType of ["diesel", "hybrid", "electric"] as const) {
      expect(vehicle("Ford", "F-150", { fuelType }).packageTier).toBe("plus");
    }
    expect(vehicle("Ford", "F-150", { fuelType: "gasoline" }).packageTier).toBe("standard");
    expect(vehicle("Volkswagen", "Golf TDI").packageTier).toBe("plus");
  });

  it("prices performance and collector models as Exotic, without matching similar names", () => {
    expect(vehicle("Porsche", "911 Carrera").packageTier).toBe("exotic");
    expect(vehicle("BMW", "M5").packageTier).toBe("exotic");
    expect(vehicle("Mercedes-Benz", "AMG GT").packageTier).toBe("exotic");
    expect(vehicle("Mercedes-Benz", "S63").packageTier).toBe("exotic");
    expect(vehicle("Toyota", "Camry", { collector: true }).packageTier).toBe("exotic");
    expect(vehicle("Toyota", "Camry M50").packageTier).toBe("standard");
  });

  it("classifies full BMW M models but not M Performance or appearance packages", () => {
    for (const model of ["M2", "M3 Competition", "M4", "M5", "M6", "M8", "X5 M", "X3 M Competition"]) {
      expect(vehicle("BMW", model).packageTier).toBe("exotic");
      expect(getPackageTier({ make: "BMW", model })).toBe("exotic");
    }
    for (const model of ["M340i", "M550i", "X3 M40i", "X5 M Sport"]) {
      expect(vehicle("BMW", model).packageTier).toBe("plus");
    }
    expect(vehicle("Audi", "M3").packageTier).toBe("plus");
  });

  it("reserves Mercedes performance pricing for AMG 63/65 and AMG GT, not 43/53 or AMG Line", () => {
    for (const model of ["C63", "E 63 S", "G63", "GLC 63", "S65", "AMG GT", "AMG GT 63"]) {
      expect(vehicle("Mercedes-Benz", model).packageTier).toBe("exotic");
    }
    for (const model of ["C43 AMG", "E53 AMG", "AMG GT 43", "AMG GT 53", "C300 AMG Line", "Maybach S580"]) {
      expect(vehicle("Mercedes-Benz", model).packageTier).toBe("plus");
    }
  });

  it("includes Porsche Turbo variants while leaving ordinary Porsche SUVs in Plus", () => {
    for (const model of ["Macan Turbo", "Cayenne Turbo", "Panamera Turbo S", "Taycan Turbo"]) {
      expect(vehicle("Porsche", model).packageTier).toBe("exotic");
    }
    expect(vehicle("Porsche", "Macan").packageTier).toBe("plus");
    expect(vehicle("Porsche", "Cayenne").packageTier).toBe("plus");
    expect(vehicle("Volkswagen", "Turbo").packageTier).toBe("plus");
  });

  it("recognizes Corvette, Mustang GT and clearly named American performance variants", () => {
    for (const [make, model] of [
      ["Chevrolet", "Corvette Stingray"], ["Chevrolet", "Corvette Z06"],
      ["Ford", "Mustang GT"], ["Ford", "Mustang Shelby GT500"],
      ["Dodge", "Challenger Hellcat"], ["Dodge", "Viper"],
    ]) {
      const result = vehicle(make, model);
      expect(result.packageTier).toBe("exotic");
      expect(result.basePrice).toBe(299);
      expect(getPriceCents(getPackageTier({ make, model }), "concierge")).toBe(29900);
    }
    expect(vehicle("Ford", "Mustang EcoBoost").packageTier).toBe("standard");
    expect(vehicle("Ford", "Mustang Mach-E GT").packageTier).toBe("plus");
    expect(vehicle("Ford", "Explorer GT").packageTier).toBe("standard");
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
