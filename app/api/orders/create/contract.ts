import { z } from "zod";
import { facebookContactSchema, isFacebookMarketplaceListing } from "@/lib/seller-contact/facebook-marketplace";

const provenanceValueSchema = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);
const provenanceFieldSchema = z.object({
  proposal: provenanceValueSchema.optional(),
  source: z.string().trim().min(1).max(120),
  evidence: z.string().trim().max(500).optional(),
  buyer_final: provenanceValueSchema.optional(),
}).strict();
const intakeProvenanceSchema = z.record(
  z.enum([
    "year", "make", "model", "trim", "mileage", "asking_price", "vin",
    "location_text", "service_zip", "seller_name", "seller_phone",
    "discovery_source", "platform_source",
  ]),
  provenanceFieldSchema,
).superRefine((value, ctx) => {
  if (JSON.stringify(value).length > 20_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Intake provenance is too large" });
  }
});

export const createOrderSchema = z.object({
  vehicle_year: z.number().int().min(1900).max(2030),
  vehicle_make: z.string().min(1).max(100),
  vehicle_model: z.string().min(1).max(100),
  vehicle_fuel_type: z.enum(["gasoline", "diesel", "hybrid", "electric"]).nullable().optional(),
  vehicle_collector: z.boolean().optional(),
  vehicle_description: z.string().max(2000).nullable().optional(),
  listing_url: z.string().url().nullable().optional(),
  vehicle_location: z.string().min(1).max(200),
  seller_name: z.string().max(100).nullable().optional(),
  seller_phone: z.string().max(20).nullable().optional(),
  seller_email: z.string().email().nullable().optional(),
  seller_available_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  seller_available_time: z.string().max(200).nullable().optional(),
  facebook_contact: facebookContactSchema.optional(),
  buyer_phone: z.string().min(7).max(20),
  buyer_email_input: z.string().email().nullable().optional(),
  booking_type: z.enum(["self_arrange", "concierge"]),
  package: z.enum(["standard", "plus", "premium", "exotic", "comprehensive"]).optional(),
  preferred_date: z.string().nullable().optional(),
  vehicle_mileage: z.number().int().min(0).nullable().optional(),
  vehicle_price: z.number().min(0).nullable().optional(),
  inspection_address: z.string().max(500).optional(),
  inspection_time_window: z.string().max(200).optional(),
  notes_to_inspector: z.string().max(2000).nullable().optional(),
  vehicle_trim: z.string().max(80).nullable().optional(),
  vin: z.string().trim().regex(/^[A-HJ-NPR-Z0-9]{17}$/i, "VIN must be 17 valid characters").nullable().optional(),
  booking_method: z.enum(["self_arrange", "buyer_arranged", "concierge"]).optional(),
  preferred_language: z.enum(["en", "es"]).optional(),
  listing_platform: z.string().trim().max(100).nullable().optional(),
  package_tier: z.string().optional(),
  intake_provenance: intakeProvenanceSchema.optional(),
  service_zip: z.string().regex(/^\d{5}$/, "ZIP must be 5 digits"),
  listing_source: z.enum([
    "online_marketplace", "dealership", "roadside", "auction",
    "referral", "offline", "other",
  ]).optional(),
  platform_source: z.string().max(60).nullable().optional(),
  vehicle_seen_location: z.string().max(300).nullable().optional(),
  seller_type: z.enum(["private_party", "dealership", "auction", "other"]).optional(),
}).superRefine((value, ctx) => {
  if (isFacebookMarketplaceListing(value.listing_url, value.platform_source)) {
    if (value.facebook_contact?.seller_consent_reported !== true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["facebook_contact"], message: "Report the seller's agreement before continuing with a Facebook Marketplace listing." });
    }
    if (value.booking_type !== "concierge" || (value.booking_method && value.booking_method !== "concierge")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["booking_type"], message: "Facebook Marketplace uses buyer-initiated contact followed by RideCheck coordination." });
    }
  }
  if (value.booking_method === "buyer_arranged" && value.booking_type !== "self_arrange") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["booking_type"],
      message: "Buyer-arranged bookings must use self_arrange booking type",
    });
  }
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export function buildOptionalOrderFields(
  data: CreateOrderInput,
  availableColumns: ReadonlySet<string>,
): { fields: Record<string, unknown>; error?: { code: string; message: string; missing_fields?: string[] } } {
  const fields: Record<string, unknown> = {};
  const setIfAvailable = (column: string, value: unknown) => {
    if (availableColumns.has(column)) fields[column] = value;
  };

  setIfAvailable("booking_method", data.booking_method ?? (data.booking_type === "self_arrange" ? "self_arrange" : "concierge"));
  setIfAvailable("preferred_language", data.preferred_language ?? "en");
  setIfAvailable("vehicle_trim", data.vehicle_trim ?? null);
  setIfAvailable("listing_platform", data.listing_platform ?? null);

  if (isFacebookMarketplaceListing(data.listing_url, data.platform_source)) {
    const sellerFields = {
      seller_email: data.seller_email,
      seller_available_date: data.seller_available_date,
      seller_available_time: data.seller_available_time,
      inspection_address: data.inspection_address,
    };
    const missing = Object.entries(sellerFields).filter(([column, value]) =>
      value && !availableColumns.has(column),
    ).map(([column]) => column);
    if (missing.length) {
      return { fields, error: { code: "seller_contact_storage_unavailable", message: "Seller information could not be saved. Please try again later.", missing_fields: missing } };
    }
    for (const [column, value] of Object.entries(sellerFields)) {
      if (value) fields[column] = value;
    }
  }

  if (data.vin) {
    if (!availableColumns.has("listing_claimed_vin")) {
      return { fields, error: { code: "vin_storage_unavailable", message: "VIN confirmation storage is temporarily unavailable. Remove the VIN and continue, or try again later." } };
    }
    fields.listing_claimed_vin = data.vin.toUpperCase();
  }
  if (data.booking_method === "buyer_arranged") {
    const required = ["inspection_address", "inspection_time_window", "notes_to_inspector"];
    const missing = required.filter((column) => !availableColumns.has(column));
    if (missing.length > 0) {
      return { fields, error: { code: "buyer_arranged_storage_unavailable", message: "Buyer-arranged scheduling storage is temporarily unavailable. Please try again later.", missing_fields: missing } };
    }
    fields.inspection_address = data.inspection_address ?? null;
    fields.inspection_time_window = data.inspection_time_window ?? null;
    fields.notes_to_inspector = data.notes_to_inspector ?? null;
  }
  if (data.intake_provenance) {
    if (!availableColumns.has("intake_provenance")) {
      return { fields, error: { code: "intake_provenance_unavailable", message: "Vehicle intake confirmation is temporarily unavailable. You can continue with manual entry." } };
    }
    fields.intake_provenance = data.intake_provenance;
  }
  return { fields };
}