import { describe, expect, it } from "vitest";
import { detectSellerPlatform, getAllowedChannels } from "../platforms";

describe("seller platform URL detection", () => {
  it("recognizes supported public domains and subdomains", () => {
    expect(detectSellerPlatform("https://www.facebook.com/marketplace/item/1")).toBe("facebook");
    expect(detectSellerPlatform("https://chicago.craigslist.org/cto/1.html")).toBe("craigslist");
    expect(detectSellerPlatform("https://offerup.com/item/detail/1")).toBe("offerup");
    expect(detectSellerPlatform("https://www.cars.com/vehicledetail/1")).toBe("dealer");
  });

  it("does not treat lookalike hostnames as trusted platforms", () => {
    expect(detectSellerPlatform("https://facebook.com.evil.test/listing")).toBe("other");
    expect(detectSellerPlatform("https://fake-facebook.com/listing")).toBe("other");
    expect(detectSellerPlatform("https://offerup.com.evil.test/vehicle")).toBe("other");
  });

  it("keeps an operational contact path for OfferUp", () => {
    expect(getAllowedChannels("offerup")).toContain("buyer_message");
  });
});