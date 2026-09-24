import { describe, expect, it } from "vitest";
import { parseListingMetadata, validateExtracted } from "../extraction";
import { intakeImageIdsRequireSession, isPrivateIntakeIp, isSafeIntakeUrl, isSessionImagePath } from "../security";

describe("booking intake extraction safety", () => {
  it("does not mislabel a page title as structured vehicle data", () => {
    const fields = parseListingMetadata('<title>2015 Toyota Camry</title>', "https://example.com/listing");
    expect(fields.year).toBeUndefined();
    expect(fields.model).toBeUndefined();
    expect(fields.vin).toBeUndefined();
    expect(fields.trim).toBeUndefined();
  });
  it("accepts only explicit structured metadata", () => {
    const fields = parseListingMetadata(
      '<script type="application/ld+json">{"@type":"Car","brand":{"name":"Toyota"},"model":"Camry","year":2015}</script>',
      "https://example.com/listing",
    );
    expect(fields.year?.value).toBe(2015);
    expect(fields.make?.value).toBe("Toyota");
    expect(fields.model?.value).toBe("Camry");
  });
  it("fails closed for malformed and unsupported metadata", () => {
    expect(parseListingMetadata("<script type=\"application/ld+json\">not-json</script>", "https://example.com")).toEqual({});
    expect(parseListingMetadata(
      '<script type="application/ld+json">{"description":"A great 2015 Toyota Camry with 80,000 miles"}</script>',
      "https://example.com",
    )).toEqual({});
  });
  it("rejects invented or invalid typed values", () => {
    const fields = validateExtracted({ year: "2015", mileage: -1, make: " Toyota ", vin: "" }, "uploaded_image", "id");
    expect(fields.year).toBeUndefined();
    expect(fields.mileage).toBeUndefined();
    expect(fields.make?.value).toBe("Toyota");
    expect(fields.vin).toBeUndefined();
  });
  it("allows URL-only fallback without an image session", () => {
    expect(intakeImageIdsRequireSession([])).toBe(false);
    expect(isSafeIntakeUrl("https://example.com/listing")?.protocol).toBe("https:");
  });
  it("denies unrelated/private and mapped IPv6 image/network targets", () => {
    expect(intakeImageIdsRequireSession(["unrelated-image-id"])).toBe(true);
    expect(isSessionImagePath("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg")).toBe(true);
    expect(isSessionImagePath("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "99999999-9999-4999-8999-999999999999/22222222-2222-4222-8222-222222222222.jpg")).toBe(false);
    expect(isPrivateIntakeIp("fc00::1")).toBe(true);
    expect(isPrivateIntakeIp("::ffff:192.168.1.10")).toBe(true);
    expect(isSafeIntakeUrl("https://[::ffff:192.168.1.10]/listing")).toBeNull();
    expect(isSafeIntakeUrl("http://example.com/listing")).toBeNull();
  });
});
