import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedReport, ReportInput, OBDModule } from "./types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const RT_LABELS: Record<string, string> = {
  engine_started_promptly:       "Engine started promptly",
  no_unusual_noises_startup:     "No unusual noises at startup",
  no_smoke_from_exhaust:         "No smoke from exhaust at startup",
  engine_ran_smoothly:           "Engine ran smoothly during drive",
  no_hesitation_rough_idling:    "No hesitation or rough idling noticed",
  transmission_shifted_smoothly: "Automatic transmission shifted smoothly",
  no_slipping_delayed_engagement:"No slipping or delayed engagement felt",
  no_unusual_sounds_gear_changes:"No unusual sounds during gear changes",
  vehicle_accelerated_normally:  "Vehicle accelerated normally",
  brakes_engaged_responsively:   "Brakes engaged responsively",
  no_pulling_when_braking:       "No pulling to one side when braking",
  no_grinding_squealing:         "No grinding or squealing noticed",
  brake_pedal_felt_firm:         "Brake pedal felt firm",
  vehicle_stopped_straight:      "Vehicle stopped straight",
  steering_felt_responsive_centered: "Steering felt responsive and centered",
  no_pulling_left_right:         "No pulling left or right",
  no_steering_wheel_vibration:   "No steering wheel vibration",
  no_unusual_noises_turning:     "No unusual noises during turning",
  no_excessive_bouncing_rattling:"No excessive bouncing or rattling",
  no_clunking_over_bumps:        "No clunking over bumps",
  ride_felt_consistent:          "Ride felt consistent with vehicle age/type",
  no_new_warning_lights:         "No new warning lights appeared",
  check_engine_unchanged:        "Check engine light status unchanged",
  abs_light_unchanged:           "ABS light status unchanged",
  vehicle_drove_as_expected:     "Vehicle drove as expected for age and mileage",
  noticeable_concerns_observed:  "Noticeable concerns observed during drive",
};

const OBD_WARNING_LABELS: Record<string, string> = {
  check_engine: "Check Engine",
  abs:          "ABS",
  airbag_srs:   "Airbag / SRS",
  battery:      "Battery",
  oil_pressure: "Oil Pressure",
  brake:        "Brake",
  tpms:         "TPMS",
  none:         "No warning lights observed",
  other:        "Other (see notes)",
};

function buildRoadTestSection(input: ReportInput): string {
  const rt = input.road_test_module;
  if (!rt) return "";

  if (rt.status === "not_permitted") {
    return "**Road Test:** Not permitted by seller.";
  }
  if (rt.status === "not_possible") {
    return "**Road Test:** Not possible due to location or vehicle condition.";
  }

  const lines: string[] = ["**Road Test Module (Structured Checklist):**"];
  lines.push("Status: Completed");

  const sections: Array<[string, string[] | undefined]> = [
    ["Engine Behavior",        rt.engine_behavior],
    ["Transmission / Shifting", rt.transmission],
    ["Brakes",                 rt.brakes],
    ["Steering & Handling",    rt.steering],
    ["Suspension",             rt.suspension],
    ["Warning Lights",         rt.warning_lights],
  ];

  for (const [title, items] of sections) {
    if (items && items.length > 0) {
      const labels = items.map((k) => RT_LABELS[k] || k).join("; ");
      lines.push(`${title}: ${labels}`);
    }
  }

  if (rt.other_lights_noted) {
    lines.push(`Other Warning Lights Noted: Yes${rt.other_lights_description ? ` — ${rt.other_lights_description}` : ""}`);
  }

  if (rt.overall && rt.overall.length > 0) {
    const overallLabels = rt.overall.map((k) => RT_LABELS[k] || k).join("; ");
    lines.push(`Overall Drive Impression: ${overallLabels}`);
  }

  if (rt.concerns_notes) {
    lines.push(`Drive Concerns Noted: ${rt.concerns_notes}`);
  }

  return lines.join("\n");
}

function buildOBDSection(input: ReportInput): string {
  const obd = input.obd_module as OBDModule | undefined;
  if (!obd) return "";

  const lines: string[] = ["**OBD-II Diagnostic Module:**"];

  // Scan status
  const statusLabels: Record<string, string> = {
    yes:           "Scan performed",
    no:            "Scan not performed",
    not_available: "Scan not available — scanner or connection issue",
    not_permitted: "Scan not permitted by seller",
  };
  lines.push(`Scan Status: ${statusLabels[obd.scan_performed] || obd.scan_performed}`);

  // Warning lights (always show if present)
  if (obd.warning_lights && obd.warning_lights.length > 0) {
    const lightLabels = obd.warning_lights
      .map((k) => OBD_WARNING_LABELS[k] || k)
      .join(", ");
    lines.push(`Warning Lights Observed: ${lightLabels}`);
    if (obd.warning_other_desc) {
      lines.push(`Other Warning Light Description: ${obd.warning_other_desc}`);
    }
    const hasCheckEngine = obd.warning_lights.includes("check_engine");
    const hasSRS         = obd.warning_lights.includes("airbag_srs");
    const hasOilPressure = obd.warning_lights.includes("oil_pressure");
    if (hasCheckEngine || hasSRS || hasOilPressure) {
      lines.push("NOTE: Active warning lights observed. These are safety-relevant findings.");
    }
  } else if (obd.scan_performed === "yes") {
    lines.push("Warning Lights: None observed during OBD session");
  }

  // Only show the following if scan was performed
  if (obd.scan_performed === "yes") {
    // DTC codes
    if (obd.dtc_codes && obd.dtc_codes.length > 0) {
      lines.push(`Diagnostic Trouble Codes (${obd.dtc_codes.length} code${obd.dtc_codes.length !== 1 ? "s" : ""}):`);
      for (const code of obd.dtc_codes) {
        const desc = code.description ? ` — ${code.description}` : "";
        lines.push(`  • ${code.system} / ${code.code} / ${code.status}${desc}`);
      }
    } else {
      lines.push("Diagnostic Trouble Codes: None entered manually");
    }

    // Uploaded files
    if (obd.uploaded_files && obd.uploaded_files.length > 0) {
      const imageCount = obd.uploaded_files.filter((f) => f.fileType === "image").length;
      const pdfCount   = obd.uploaded_files.filter((f) => f.fileType === "pdf").length;
      const parts: string[] = [];
      if (imageCount > 0) parts.push(`${imageCount} image${imageCount !== 1 ? "s" : ""}`);
      if (pdfCount   > 0) parts.push(`${pdfCount} PDF${pdfCount !== 1 ? "s" : ""}`);
      lines.push(`Uploaded Diagnostic Evidence: ${parts.join(", ")} (${obd.uploaded_files.map((f) => f.fileName).join(", ")})`);
    } else {
      lines.push("Uploaded Diagnostic Evidence: None uploaded");
    }

    // Emissions
    if (obd.emissions_readiness) {
      const emissionLabels: Record<string, string> = {
        ready:     "Ready",
        not_ready: "Not Ready",
        unknown:   "Unknown / Not checked",
      };
      lines.push(`Emissions Readiness: ${emissionLabels[obd.emissions_readiness] || obd.emissions_readiness}`);
    }

    // Notes
    if (obd.notes) {
      lines.push(`Inspector OBD Notes: ${obd.notes}`);
    }
  }

  return lines.join("\n");
}

function buildPrompt(input: ReportInput): string {
  const tires = [
    input.tire_tread_mm_front_left != null ? `FL: ${input.tire_tread_mm_front_left}mm` : null,
    input.tire_tread_mm_front_right != null ? `FR: ${input.tire_tread_mm_front_right}mm` : null,
    input.tire_tread_mm_rear_left != null ? `RL: ${input.tire_tread_mm_rear_left}mm` : null,
    input.tire_tread_mm_rear_right != null ? `RR: ${input.tire_tread_mm_rear_right}mm` : null,
  ].filter(Boolean).join(", ") || "Not measured";

  const scanCodes = input.scan_codes?.length
    ? input.scan_codes.join(", ")
    : "None detected";

  const sourceLabel =
    input.listing_source === "dealership" ? "Used Car Dealership" :
    input.listing_source === "roadside"   ? "Roadside / For Sale Sign" :
    "Online Marketplace / Listing";

  const platformLabel = input.platform_source
    ? input.platform_source.replace(/_/g, " ")
    : null;

  const obdSection   = buildOBDSection(input);
  const roadSection  = buildRoadTestSection(input);

  return `You are a senior automotive analyst for RideCheck, a Vehicle Transparency Platform based in Lake County, Illinois.

You have received raw inspection findings from a RideChecker (certified inspector) and must transform them into a structured vehicle intelligence report. Your role is to describe what was observed — not to advise whether the vehicle should be purchased.

## VEHICLE DETAILS
- Year: ${input.vehicle_year}
- Make: ${input.vehicle_make}
- Model: ${input.vehicle_model}
- Trim: ${input.vehicle_trim || "Not specified"}
- Mileage: ${input.vehicle_mileage ? `${input.vehicle_mileage.toLocaleString()} mi` : "Not recorded"}
- Asking Price: ${input.vehicle_price ? `$${input.vehicle_price.toLocaleString()}` : "Not provided"}
- Inspection Location: ${input.inspection_address || "Illinois area"}
- Inspection Date: ${input.inspection_date}
- Package: ${input.package}

## TRANSACTION CONTEXT
- Vehicle Source: ${sourceLabel}${platformLabel ? ` (${platformLabel})` : ""}${input.vehicle_seen_location ? `\n- Car Parked At: ${input.vehicle_seen_location}` : ""}

## RAW INSPECTION FINDINGS

**Cosmetic / Exterior:**
${input.cosmetic_exterior}

**Interior Condition:**
${input.interior_condition}

**Mechanical Issues:**
${input.mechanical_issues}

**Test Drive Notes:**
${input.test_drive_notes}

**Immediate Concerns:**
${input.immediate_concerns}

**Legacy OBD-II Scan Codes:** ${scanCodes}

**Brake Condition:** ${input.brake_condition || "Not assessed"}

**Tire Tread Depth:** ${tires}

${obdSection}

${roadSection}

## YOUR TASK

Analyze these findings and return a single valid JSON object (no markdown, no commentary — only the JSON) that strictly follows this schema:

{
  "verdict": one of: "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK",
  "verdict_tagline": "A concise 8-12 word neutral summary of the primary risk finding",
  "overall_summary": "A 2-3 sentence plain-English summary of the vehicle's observed condition and estimated financial exposure",
  "top_insights": [
    {
      "title": "TITLE IN CAPS (max 6 words)",
      "body": "2-4 sentence plain-English explanation of the finding and its financial or safety significance"
    }
    // exactly 3 items
  ],
  "systems": [
    {
      "name": "System name (e.g. ENGINE / POWERTRAIN)",
      "status": "GOOD" | "MONITOR" | "RISK" | "FAIL",
      "observed": "Only what the RideChecker physically saw, scanned, heard, photographed, measured, or selected. 1-3 sentences. No interpretation.",
      "consideration": "Neutral mechanical context using general language. What this type of finding typically means, estimated cost range, or why professional assessment is recommended. 1-2 sentences. No purchase advice.",
      "cost_low": number or null,
      "cost_high": number or null,
      "cost_note": "Optional note if cost cannot be estimated (e.g. 'Lift inspection recommended')"
    }
    // Include ALL relevant systems. Cover at minimum: Engine/Powertrain, Brakes, Body/Exterior, Interior, Tires, Battery/Electrical, Transmission/Drivetrain. Add Emissions, Frame/Underbody, ABS as needed.
    // If OBD data was collected (structured module OR legacy codes), include an OBD/Emissions system entry reflecting the specific codes, warning lights, and emissions readiness found.
  ],
  "obd_entries": [
    {
      "system": "System name (e.g. Powertrain, ABS, Emissions Ready, Battery Voltage, Service Interval)",
      "status_label": "ON" | "OFF" | voltage reading (e.g. "14.09V") | "NOT READY" | "READY",
      "codes": "Comma-separated codes or — if none",
      "description": "Brief plain-English description of the code or status",
      "is_active": true if warning light is ON or status is a fail/not-ready, false otherwise
    }
    // Include one entry per system. If structured OBD module is present, reflect its codes and warning lights here.
    // If no OBD data at all, include key systems with unknown/unscanned status.
  ],
  "repair_estimates": [
    {
      "item": "Repair item name",
      "priority": "Immediate" | "Soon" | "Optional" | "Monitor",
      "cost_low": number,
      "cost_high": number
    }
    // Use Chicago-area labor rates. Only include items where repair cost can be estimated. Sort by priority.
    // OBD-identified codes with known repair ranges should appear here.
  ],
  "total_repair_low": sum of all cost_low values,
  "total_repair_high": sum of all cost_high values,
  "negotiation_options": [
    {
      "label": "OPTION A: Label (e.g. Request Seller Price Adjustment, Proceed at Current Price, Request Pre-Sale Repairs, Consider Alternative Vehicles)",
      "description": "3-4 sentences of specific, neutral guidance describing this option and its estimated financial implications"
    }
    // 2-3 options. Do not use language like Walk Away, Do Not Buy, Avoid, or You Should. Frame as price and condition considerations only.
    // If recommending the buyer look elsewhere, use label: "Consider Alternative Vehicles" — not "Walk Away".
  ]
}

## GUIDELINES
- Be direct, factual, and neutral. Describe what was observed, identified, or noted — not what the buyer should do.
- Use language like: observed, noted, identified, estimated, may, could range, typically, professional assessment recommended.
- Never use: "do not buy", "walk away", "avoid this vehicle", "you should buy", "you should not buy", "do not purchase".
- Cost estimates should reflect Chicago/Lake County area shop rates.
- "Immediate" = safety issue or registration blocker. "Soon" = needed within 6 months. "Optional" = cosmetic or comfort. "Monitor" = watch but not urgent.
- Tire tread: < 3mm = replace immediately, 3-5mm = monitor, > 5mm = good.
- OBD guidelines:
  - If structured OBD module present with codes: explain each code system and status in the observed field. P-codes = Powertrain, C-codes = Chassis/ABS, B-codes = Body, U-codes = Network.
  - Active codes raise risk level more than Pending or Stored codes.
  - Check engine light observed with no codes = still a finding worth noting.
  - Emissions "Not Ready" = potential registration issue in emissions-test states.
  - If seller did not permit scan or scanner unavailable, note this as a limitation.
- Risk level guidance: LOW_RISK = minor findings only with estimated total repairs under $500; MODERATE_RISK = estimated $500–$2,500 in repairs or notable but non-safety-critical findings identified; HIGH_RISK = estimated $2,500+ in repairs, safety-critical findings noted, or structural concerns identified.

Return ONLY the JSON object. Do not wrap it in markdown code blocks.`;
}

export async function generateReportWithClaude(
  input: ReportInput
): Promise<GeneratedReport> {
  const prompt = buildPrompt(input);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const rawText =
    message.content[0].type === "text" ? message.content[0].text : "";

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const report = JSON.parse(cleaned) as GeneratedReport;

  if (
    !report.verdict ||
    !report.top_insights ||
    !report.systems ||
    !report.repair_estimates
  ) {
    throw new Error("Claude returned an incomplete report structure");
  }

  return report;
}
