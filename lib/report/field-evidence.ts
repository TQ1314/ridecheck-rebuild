import type { OBDModule, RoadTestModule } from "./types";

export function roadTestEvidence(
  roadTest?: RoadTestModule | null,
): { level: string; status: "assessed" | "not_assessed"; transmission: string; missing?: string } {
  if (roadTest?.status === "completed") {
    return {
      level: "Completed",
      status: "assessed",
      transmission: roadTest.transmission?.length ? "Road Test Observed" : "Visual Only",
    };
  }
  if (roadTest?.status === "not_permitted") {
    return { level: "Not Permitted by Seller", status: "not_assessed", transmission: "Visual Only", missing: "Road test not permitted by seller" };
  }
  if (roadTest?.status === "not_possible") {
    return { level: "Not Possible — Location/Condition", status: "not_assessed", transmission: "Visual Only", missing: "Road test not possible — location or vehicle condition" };
  }
  return { level: "Not Performed", status: "not_assessed", transmission: "Visual Only", missing: "Road test not performed" };
}

// Keep original evidence in storage, but only human-confirmed extracted codes
// may be sent to Claude or included in a buyer-facing report.
export function reportableOBD(obd?: OBDModule | null): OBDModule | undefined {
  if (!obd) return undefined;
  const evidenceUrls = new Set((obd.uploaded_files ?? []).map((file) => file.url));
  const accepted = (code: NonNullable<OBDModule["dtc_codes"]>[number]) =>
    code.source === "manual" ||
    ((code.source === "ai_extracted" || code.source === "parsed_text") &&
      code.accepted === true && (code.extraction_confidence ?? 0) >= 60 &&
      !!code.source_file_url && evidenceUrls.has(code.source_file_url));
  return {
    ...obd,
    dtc_codes: (obd.dtc_codes ?? []).filter(accepted),
    unreviewed_code_count: (obd.dtc_codes ?? []).filter((code) => !accepted(code)).length,
  };
}

export function hasConfirmedOBDEvidence(obd?: OBDModule | null): boolean {
  if (obd?.scan_performed !== "yes") return false;
  return (obd.dtc_codes?.length ?? 0) > 0 ||
    (obd.uploaded_files ?? []).some((file) =>
      file.extraction_status === "processed" && (file.extraction_confidence ?? 0) >= 60
    );
}

export function uniqueExtractedCodes<T extends { code: string }>(
  existing: Array<{ code: string }>,
  extracted: T[],
): T[] {
  const seen = new Set(existing.map((entry) => entry.code.trim().toUpperCase()));
  return extracted.filter((entry) => {
    const code = entry.code?.trim().toUpperCase();
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}