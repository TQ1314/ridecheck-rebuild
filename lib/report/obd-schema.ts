import { z } from "zod";

export const obdUploadedFileSchema = z.object({
  url: z.string(),
  fileName: z.string(),
  fileType: z.enum(["image", "pdf", "txt", "csv"]),
  reviewStatus: z.enum(["approved_for_report", "needs_review", "excluded_from_report"]).default("approved_for_report"),
  ai_extracted: z.boolean().optional(),
  extraction_method: z.enum(["ai", "text_parser"]).optional(),
  extraction_status: z.enum(["pending", "processed", "failed"]).optional(),
  extraction_confidence: z.number().min(0).max(100).optional(),
  ocr_quality: z.string().optional(),
  scanner_brand: z.string().optional(),
  scanner_model: z.string().optional(),
});

export const obdDTCCodeSchema = z.object({
  system: z.string(),
  code: z.string(),
  description: z.string().optional().default(""),
  status: z.string(),
  source: z.enum(["manual", "ai_extracted", "parsed_text"]).optional(),
  accepted: z.boolean().optional(),
  extraction_confidence: z.number().min(0).max(100).optional(),
  source_file_url: z.string().optional(),
});

export const obdModuleSchema = z.object({
  scan_performed: z.enum(["yes", "no", "not_available", "not_permitted"]),
  scanner_brand: z.string().optional(),
  scanner_model: z.string().optional(),
  uploaded_files: z.array(obdUploadedFileSchema).optional(),
  dtc_codes: z.array(obdDTCCodeSchema).optional(),
  notes: z.string().optional(),
  emissions_readiness: z.enum(["ready", "not_ready", "unknown"]).optional(),
  warning_lights: z.array(z.string()).optional(),
  warning_other_desc: z.string().optional(),
});