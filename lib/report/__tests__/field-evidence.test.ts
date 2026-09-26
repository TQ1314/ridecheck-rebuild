import { describe, expect, it } from "vitest";
import { hasConfirmedOBDEvidence, roadTestEvidence, reportableOBD, uniqueExtractedCodes } from "../field-evidence";
import { obdModuleSchema } from "../obd-schema";
import type { OBDModule } from "../types";

describe("road-test evidence", () => {
  it("marks a documented completed test, but not transmission without observations", () => {
    expect(roadTestEvidence({ status: "completed" })).toMatchObject({
      level: "Completed", status: "assessed", transmission: "Visual Only",
    });
    expect(roadTestEvidence({ status: "completed", transmission: ["smooth"] }).transmission)
      .toBe("Road Test Observed");
  });
  it("distinguishes seller refusal and impossibility", () => {
    expect(roadTestEvidence({ status: "not_permitted" })).toMatchObject({
      level: "Not Permitted by Seller", status: "not_assessed", missing: "Road test not permitted by seller",
    });
    expect(roadTestEvidence({ status: "not_possible" })).toMatchObject({
      level: "Not Possible — Location/Condition", status: "not_assessed",
    });
  });
  it("does not infer completion from absent module or generic notes", () => {
    for (const notes of ["Wizard submission — see inspection steps", ""]) {
      const raw = { test_drive_notes: notes };
      expect(roadTestEvidence(undefined)).toMatchObject({
        level: "Not Performed", status: "not_assessed", transmission: "Visual Only",
        missing: "Road test not performed",
      });
      expect(raw.test_drive_notes).toBeDefined();
    }
  });
});

const base: OBDModule = { scan_performed: "yes", scanner_brand: "Autel", scanner_model: "MX808" };
const file = {
  url: "https://example.test/scan", fileName: "scan", reviewStatus: "approved_for_report" as const,
  extraction_confidence: 88, extraction_status: "processed" as const,
};

describe("OBD persistence and buyer-report boundary", () => {
  it.each(["pdf", "image", "txt", "csv"] as const)(
    "accepts %s original evidence and extraction provenance through the submit contract",
    (fileType) => {
      const result = obdModuleSchema.parse({
        ...base,
        uploaded_files: [{
          ...file, fileType, extraction_method: fileType === "txt" || fileType === "csv" ? "text_parser" : "ai",
          ai_extracted: fileType === "pdf" || fileType === "image",
          ocr_quality: "Clear", scanner_brand: "Autel", scanner_model: "MX808",
        }],
        dtc_codes: [{ system: "Powertrain", code: "P0420", status: "Active",
          source: fileType === "txt" || fileType === "csv" ? "parsed_text" : "ai_extracted",
          accepted: true, extraction_confidence: 88, source_file_url: file.url }],
      });
      expect(result.uploaded_files?.[0]).toMatchObject({
        fileType, extraction_confidence: 88, scanner_brand: "Autel", scanner_model: "MX808",
        extraction_status: "processed",
      });
      expect(reportableOBD(result)?.dtc_codes?.[0]).toMatchObject({ code: "P0420", accepted: true });
      expect(hasConfirmedOBDEvidence(reportableOBD(result))).toBe(true);
    },
  );
  it("keeps unreviewed and low-confidence candidates out, but preserves the file", () => {
    const raw = obdModuleSchema.parse({
      ...base, uploaded_files: [{ ...file, fileType: "image", extraction_confidence: 42,
        ocr_quality: "Poor", reviewStatus: "needs_review" }],
      dtc_codes: [{ system: "Powertrain", code: "P0420", status: "Active",
        source: "ai_extracted", accepted: false, extraction_confidence: 42,
        source_file_url: file.url }],
    });
    expect(reportableOBD(raw)).toMatchObject({
      dtc_codes: [], unreviewed_code_count: 1, uploaded_files: [{ extraction_confidence: 42 }],
    });
    expect(hasConfirmedOBDEvidence(reportableOBD(raw))).toBe(false);
  });
  it("preserves manual source and does not require AI acceptance", () => {
    const raw = obdModuleSchema.parse({ ...base, dtc_codes: [
      { system: "Powertrain", code: "P0300", status: "Active", source: "manual" },
      { system: "Powertrain", code: "P0420", status: "Active", source: "ai_extracted" },
    ] });
    expect(reportableOBD(raw)?.dtc_codes).toEqual([
      expect.objectContaining({ code: "P0300", source: "manual" }),
    ]);
    expect(reportableOBD(raw)?.unreviewed_code_count).toBe(1);
  });
  it("does not promote a low-confidence candidate even if marked accepted", () => {
    const raw = obdModuleSchema.parse({ ...base, uploaded_files: [{ ...file, fileType: "image", extraction_confidence: 42 }], dtc_codes: [
      { system: "Powertrain", code: "P0420", status: "Active", source: "ai_extracted",
        accepted: true, extraction_confidence: 42, source_file_url: file.url },
    ] });
    expect(reportableOBD(raw)?.dtc_codes).toEqual([]);
    expect(hasConfirmedOBDEvidence(reportableOBD(raw))).toBe(false);
  });
  it("does not include an extracted code after its original file is removed", () => {
    const raw = obdModuleSchema.parse({ ...base, dtc_codes: [
      { system: "Powertrain", code: "P0420", status: "Active", source: "ai_extracted",
        accepted: true, extraction_confidence: 88, source_file_url: file.url },
    ] });
    expect(reportableOBD(raw)?.dtc_codes).toEqual([]);
  });
  it("does not replace a manual code's source with duplicate extracted codes", () => {
    const manual = [{ code: "P0420", source: "manual" }];
    const additions = uniqueExtractedCodes(manual, [
      { code: "p0420", source: "ai_extracted" },
      { code: "P0300", source: "ai_extracted" },
      { code: "p0300", source: "ai_extracted" },
    ]);
    expect(manual).toEqual([{ code: "P0420", source: "manual" }]);
    expect(additions).toEqual([{ code: "P0300", source: "ai_extracted" }]);
  });
});