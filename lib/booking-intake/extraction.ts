export const INTAKE_KEYS = [
  "year", "make", "model", "trim", "mileage", "asking_price",
  "location_text", "service_zip", "vin", "seller_name", "seller_phone",
  "discovery_source", "platform_source",
] as const;
export type IntakeKey = typeof INTAKE_KEYS[number];
export type ExtractedField = {
  value: string | number;
  source_type: "listing_url" | "uploaded_image";
  source_reference: string;
  evidence: string;
};
export type IntakeFields = Partial<Record<IntakeKey, ExtractedField>>;

const FIELD_TYPES: Record<IntakeKey, "string" | "number"> = {
  year: "number", make: "string", model: "string", trim: "string",
  mileage: "number", asking_price: "number", location_text: "string",
  service_zip: "string", vin: "string", seller_name: "string",
  seller_phone: "string", discovery_source: "string", platform_source: "string",
};

export function validateExtracted(input: unknown, sourceType: ExtractedField["source_type"], reference: string): IntakeFields {
  if (!input || typeof input !== "object") return {};
  const out: IntakeFields = {};
  for (const key of INTAKE_KEYS) {
    const candidate = (input as Record<string, unknown>)[key];
    if (!candidate || typeof candidate !== FIELD_TYPES[key]) continue;
    if (typeof candidate === "string" && !candidate.trim()) continue;
    if (typeof candidate === "number" && (!Number.isFinite(candidate) || candidate < 0)) continue;
    const evidence = (input as Record<string, unknown>)[`${key}_evidence`];
    out[key] = {
      value: typeof candidate === "string" ? candidate.trim() : candidate as number,
      source_type: sourceType,
      source_reference: reference,
      evidence: typeof evidence === "string" ? evidence.slice(0, 240) : "",
    };
  }
  return out;
}

export function parseListingMetadata(html: string, reference: string): IntakeFields {
  const values: Record<string, unknown> = {};
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(match[1]);
      const item = Array.isArray(json) ? json.find((x) => x && typeof x === "object") : json;
      if (item && typeof item === "object") {
        const v = item as Record<string, unknown>;
        const vehicle = (v.vehicle as Record<string, unknown> | undefined) ?? v;
        for (const key of ["name", "model", "brand", "manufacturer", "year", "vin", "telephone", "seller_name", "mileageFromOdometer", "offers", "address"]) {
          if (vehicle[key] !== undefined) values[key] = vehicle[key];
        }
      }
    } catch { /* untrusted page metadata */ }
  }
  const out: IntakeFields = {};
  const explicit = (key: string): string | null => {
    const value = values[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 240);
    return null;
  };
  const model = explicit("model");
  const brandValue = values.brand;
  const brand = typeof brandValue === "string" ? brandValue : brandValue && typeof brandValue === "object" ? explicitObjectName(brandValue) : null;
  const yearValue = values.year;
  if (typeof yearValue === "number" && Number.isInteger(yearValue) && yearValue >= 1900 && yearValue <= 2100) {
    out.year = { value: yearValue, source_type: "listing_url", source_reference: reference, evidence: String(yearValue) };
  }
  if (brand) out.make = { value: brand, source_type: "listing_url", source_reference: reference, evidence: brand };
  if (model) out.model = { value: model, source_type: "listing_url", source_reference: reference, evidence: model };
  const vin = explicit("vin");
  if (vin) out.vin = { value: vin, source_type: "listing_url", source_reference: reference, evidence: vin };
  const phone = explicit("telephone");
  if (phone) out.seller_phone = { value: phone, source_type: "listing_url", source_reference: reference, evidence: phone };
  const sellerName = explicit("seller_name");
  if (sellerName) out.seller_name = { value: sellerName, source_type: "listing_url", source_reference: reference, evidence: sellerName };
  const address = values.address;
  if (address && typeof address === "object") {
    const addressText = Object.values(address as Record<string, unknown>).filter((v): v is string => typeof v === "string" && v.length < 120).join(", ").slice(0, 240);
    if (addressText) out.location_text = { value: addressText, source_type: "listing_url", source_reference: reference, evidence: addressText };
    const zip = (address as Record<string, unknown>).postalCode;
    if (typeof zip === "string" && /^\d{5}(?:-\d{4})?$/.test(zip)) out.service_zip = { value: zip.slice(0, 5), source_type: "listing_url", source_reference: reference, evidence: zip };
  }
  const mileage = values.mileageFromOdometer;
  const mileageValue = typeof mileage === "object" && mileage ? (mileage as Record<string, unknown>).value : mileage;
  if (typeof mileageValue === "number" && Number.isFinite(mileageValue)) out.mileage = { value: mileageValue, source_type: "listing_url", source_reference: reference, evidence: String(mileageValue) };
  const offers = values.offers;
  const price = offers && typeof offers === "object" ? (offers as Record<string, unknown>).price : null;
  if (typeof price === "number" && Number.isFinite(price)) out.asking_price = { value: price, source_type: "listing_url", source_reference: reference, evidence: String(price) };
  return out;
}

function explicitObjectName(value: object): string | null {
  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 240) : null;
}

export function mergeFields(...groups: IntakeFields[]): IntakeFields {
  return Object.assign({}, ...groups);
}
