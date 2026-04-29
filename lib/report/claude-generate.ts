import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedReport, ReportInput } from "./types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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

  return `You are a senior automotive analyst for RideCheck, a pre-purchase vehicle intelligence platform based in Lake County, Illinois.

You have received raw inspection findings from a RideChecker (certified inspector) and must transform them into a structured intelligence report for the buyer.

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

## PURCHASE CONTEXT
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

**OBD-II Scan Codes:** ${scanCodes}

**Brake Condition:** ${input.brake_condition || "Not assessed"}

**Tire Tread Depth:** ${tires}

## YOUR TASK

Analyze these findings and return a single valid JSON object (no markdown, no commentary — only the JSON) that strictly follows this schema:

{
  "verdict": one of: "BUY" | "NEGOTIATE" | "DO_NOT_BUY_AT_ASKING" | "WALK_AWAY",
  "verdict_tagline": "A concise 8-12 word reason for the verdict",
  "overall_summary": "A 2-3 sentence plain-English summary of the vehicle's condition for the buyer",
  "top_insights": [
    {
      "title": "TITLE IN CAPS (max 6 words)",
      "body": "2-4 sentence plain-English explanation of why this matters to the buyer"
    }
    // exactly 3 items
  ],
  "systems": [
    {
      "name": "System name (e.g. ENGINE / POWERTRAIN)",
      "status": "GOOD" | "MONITOR" | "RISK" | "FAIL",
      "description": "2-4 sentences describing the finding and its significance",
      "cost_low": number or null,
      "cost_high": number or null,
      "cost_note": "Optional note if cost cannot be estimated (e.g. 'Lift inspection needed')"
    }
    // Include ALL relevant systems. Cover at minimum: Engine/Powertrain, Brakes, Body/Exterior, Interior, Tires, Battery/Electrical, Transmission/Drivetrain. Add Emissions, Frame/Underbody, ABS as needed.
  ],
  "obd_entries": [
    {
      "system": "System name (e.g. Powertrain, ABS, Emissions Ready, Battery Voltage, Service Interval)",
      "status_label": "ON" | "OFF" | voltage reading (e.g. "14.09V") | "NOT READY" | "READY",
      "codes": "Comma-separated codes or — if none",
      "description": "Brief plain-English description of the code or status",
      "is_active": true if warning light is ON or status is a fail/not-ready, false otherwise
    }
    // Include one entry per system. If no scan codes, include entries for key systems with status.
  ],
  "repair_estimates": [
    {
      "item": "Repair item name",
      "priority": "Immediate" | "Soon" | "Optional" | "Monitor",
      "cost_low": number,
      "cost_high": number
    }
    // Use Chicago-area labor rates. Only include items where repair cost can be estimated. Sort by priority.
  ],
  "total_repair_low": sum of all cost_low values,
  "total_repair_high": sum of all cost_high values,
  "negotiation_options": [
    {
      "label": "OPTION A: Label (e.g. Walk Away, Negotiate, Request Repairs)",
      "description": "3-4 sentences of specific, actionable advice for this option"
    }
    // 2-3 options
  ]
}

## GUIDELINES
- Be direct, factual, and buyer-focused. No fluff.
- Cost estimates should reflect Chicago/Lake County area shop rates.
- "Immediate" = safety issue or registration blocker. "Soon" = needed within 6 months. "Optional" = cosmetic or comfort. "Monitor" = watch but not urgent.
- Tire tread: < 3mm = replace immediately, 3-5mm = monitor, > 5mm = good.
- If OBD codes are present, explain them in plain English.
- Verdict guidance: BUY = minor issues only, NEGOTIATE = $500-$2,500 in repairs needed, DO_NOT_BUY_AT_ASKING = $2,500+ in repairs / significant issues, WALK_AWAY = safety-critical or structural damage present.

Return ONLY the JSON object. Do not wrap it in markdown code blocks.`;
}

export async function generateReportWithClaude(
  input: ReportInput
): Promise<GeneratedReport> {
  const prompt = buildPrompt(input);

  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
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
