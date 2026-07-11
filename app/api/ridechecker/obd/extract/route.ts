import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const LOW_CONFIDENCE_THRESHOLD = 60;

const EXTRACTION_PROMPT = `You are analyzing an OBD-II diagnostic scanner output — this may be a PDF report, a screenshot of a scanner display, or a photo of a scanner screen.

Your task: extract all diagnostic information and return it as a single JSON object.

Return ONLY valid JSON — no markdown, no explanation, no code fences. Use this exact structure:
{
  "codes": [
    {
      "system": "Powertrain",
      "code": "P0430",
      "status": "Active",
      "description": "Catalyst efficiency below threshold bank 2"
    }
  ],
  "scanner_brand": "Topdon",
  "scanner_model": "Phoenix Nano",
  "warning_lights": ["check_engine"],
  "emissions_status": "not_ready",
  "confidence_score": 92,
  "ocr_quality": "Excellent — all codes clearly readable",
  "notes": null
}

Field rules:
- system: P-codes → "Powertrain", C-codes → "Chassis", B-codes → "Body", U-codes → "Network". If uncertain, use "Unknown".
- status: "Active", "Pending", "Stored", or "Unknown". Map: Current→Active, History→Stored, Confirmed→Active.
- scanner_brand: detect from headers, logos, watermarks, copyright. Known brands: Topdon, Autel, Launch, BlueDriver, FIXD, ThinkCar, INNOVA, Bosch, Actron. Use null if not detectable.
- scanner_model: specific model name if visible (e.g. "Phoenix Nano", "MaxiCOM MK808"). Use null if not visible.
- warning_lights: only from this set — "check_engine", "abs", "airbag_srs", "battery", "oil_pressure", "brake", "tpms". Empty array if none visible.
- emissions_status: "ready" if all monitors pass, "not_ready" if any incomplete/failing, "unknown" if not shown, null if not applicable.
- confidence_score: integer 0–100.
  - 80–100: codes are fully legible with no ambiguity
  - 60–79: most codes readable but some uncertainty exists
  - 40–59: image is blurry, partial, or heavily compressed — codes may be inaccurate
  - 0–39: content is too unclear to extract reliably
- ocr_quality: short human-readable phrase, e.g. "Excellent", "Good", "Fair — image partially blurry", "Poor — low resolution image detected"
- notes: any relevant observation not captured above (e.g. "freeze frame data present"), or null.
- CRITICAL: Do NOT invent codes. If you cannot read a code with confidence, omit it. Empty "codes" array is correct when nothing is clearly readable.
- Do NOT diagnose, recommend repairs, or recommend purchase decisions.`;

function confidenceFromLabel(label: string): number {
  if (label === "high") return 88;
  if (label === "medium") return 70;
  if (label === "low") return 42;
  const n = parseInt(label, 10);
  return isNaN(n) ? 70 : n;
}

function systemFromCode(code: string): string {
  const prefix = code.toUpperCase().charAt(0);
  return prefix === "P" ? "Powertrain"
       : prefix === "C" ? "Chassis"
       : prefix === "B" ? "Body"
       : prefix === "U" ? "Network"
       : "Unknown";
}

function parsePlainText(text: string): ExtractionResult {
  const codeRegex = /\b([PBCU][0-9A-F]{4})\b/gi;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = codeRegex.exec(text)) !== null) {
    found.add(match[1].toUpperCase());
  }

  const codes = Array.from(found).map((code) => {
    const lineRegex = new RegExp(`${code}[^\\n]*`, "i");
    const line = text.match(lineRegex)?.[0] || "";
    const statusMatch = line.match(/\b(active|pending|stored|current|history|confirmed)\b/i);
    const status = statusMatch
      ? statusMatch[1].toLowerCase() === "current" ? "Active"
        : statusMatch[1].toLowerCase() === "history" ? "Stored"
        : statusMatch[1].charAt(0).toUpperCase() + statusMatch[1].slice(1).toLowerCase()
      : "Unknown";
    const desc = line.replace(code, "").replace(/[-–—|:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    return { system: systemFromCode(code), code, status, description: desc || "" };
  });

  const brandRegex = /\b(topdon|autel|launch|bluedriver|fixd|thinkcar|innova|bosch|actron)\b/i;
  const brandMatch = text.match(brandRegex);
  const scanner_brand = brandMatch
    ? brandMatch[1].charAt(0).toUpperCase() + brandMatch[1].slice(1).toLowerCase()
    : null;

  const notReady = /not[\s_-]?ready|incomplete|failing/i.test(text);
  const ready = /\bready\b/i.test(text) && !notReady;
  const emissions_status = notReady ? "not_ready" : ready ? "ready" : null;

  const warning_lights: string[] = [];
  if (/check[\s_-]?engine/i.test(text)) warning_lights.push("check_engine");
  if (/\babs\b/i.test(text)) warning_lights.push("abs");
  if (/airbag|srs/i.test(text)) warning_lights.push("airbag_srs");

  const confidence_score = codes.length > 0 ? 95 : 75;
  const ocr_quality = "Text export — direct parse, no OCR required";

  return { codes, scanner_brand, scanner_model: null, warning_lights, emissions_status, confidence_score, ocr_quality, notes: null };
}

interface DtcCode {
  system: string;
  code: string;
  status: string;
  description: string;
}

interface ExtractionResult {
  codes: DtcCode[];
  scanner_brand: string | null;
  scanner_model: string | null;
  warning_lights: string[];
  emissions_status: string | null;
  confidence_score: number;
  ocr_quality: string;
  notes: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();
    const p = profileRow as any;
    if (!p || !["ridechecker_active", "owner", "admin"].includes(p.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { file_url, file_name, file_type } = body as {
      file_url: string;
      file_name: string;
      file_type: string;
    };

    if (!file_url) return NextResponse.json({ error: "file_url required" }, { status: 400 });

    const lower = (file_name || "").toLowerCase();
    const isTxt = lower.endsWith(".txt") || file_type === "text/plain";
    const isCsv = lower.endsWith(".csv") || file_type === "text/csv";
    const isPdf = lower.endsWith(".pdf") || file_type === "application/pdf";

    const fileRes = await fetch(file_url);
    if (!fileRes.ok) {
      return NextResponse.json({ error: "Could not fetch file for extraction" }, { status: 400 });
    }

    let result: ExtractionResult;

    if (isTxt || isCsv) {
      const text = await fileRes.text();
      result = parsePlainText(text);
    } else {
      const buffer = await fileRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      let content: Anthropic.MessageParam["content"];
      if (isPdf) {
        content = [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          } as unknown as Anthropic.ContentBlockParam,
          { type: "text", text: EXTRACTION_PROMPT },
        ];
      } else {
        const mimeType = (file_type?.startsWith("image/") ? file_type : "image/jpeg") as
          | "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        content = [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          { type: "text", text: EXTRACTION_PROMPT },
        ];
      }

      const msg = await client.messages.create({
        model: "claude-haiku-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content }],
      });

      const raw = msg.content.find((c) => c.type === "text")?.text || "{}";
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      }

      const rawConfidence = parsed.confidence_score ?? parsed.confidence;
      const confidence_score =
        typeof rawConfidence === "number"
          ? Math.round(Math.max(0, Math.min(100, rawConfidence)))
          : typeof rawConfidence === "string"
          ? confidenceFromLabel(rawConfidence)
          : 70;

      result = {
        codes: (parsed.codes as DtcCode[]) || [],
        scanner_brand: (parsed.scanner_brand as string) || null,
        scanner_model: (parsed.scanner_model as string) || null,
        warning_lights: (parsed.warning_lights as string[]) || [],
        emissions_status: (parsed.emissions_status as string) || null,
        confidence_score,
        ocr_quality: (parsed.ocr_quality as string) || (confidence_score >= 80 ? "Good" : confidence_score >= 60 ? "Fair" : "Poor"),
        notes: (parsed.notes as string) || null,
      };
    }

    // If confidence is too low, return codes as low_confidence_codes and clear codes
    // so the UI can warn the user without auto-populating
    const isLowConfidence = result.confidence_score < LOW_CONFIDENCE_THRESHOLD;
    return NextResponse.json({
      codes: isLowConfidence ? [] : result.codes,
      low_confidence_codes: isLowConfidence ? result.codes : [],
      scanner_brand: result.scanner_brand,
      scanner_model: result.scanner_model,
      warning_lights: result.warning_lights,
      emissions_status: result.emissions_status,
      confidence_score: result.confidence_score,
      ocr_quality: result.ocr_quality,
      notes: result.notes,
      method: isTxt || isCsv ? "text_parse" : isPdf ? "claude_pdf" : "claude_vision",
    });
  } catch (err) {
    console.error("[obd/extract]", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
