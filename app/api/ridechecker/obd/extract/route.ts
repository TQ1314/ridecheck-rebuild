import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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
  "warning_lights": ["check_engine"],
  "emissions_status": "not_ready",
  "confidence": "high",
  "notes": null
}

Rules:
- system: P-codes → "Powertrain", C-codes → "Chassis", B-codes → "Body", U-codes → "Network". If uncertain, use "Unknown".
- status: use "Active", "Pending", "Stored", or "Unknown" — map from whatever the scanner calls them (Current→Active, History→Stored, etc.)
- scanner_brand: detect from headers, logos, watermarks, or copyright text. Known brands: Topdon, Autel, Launch, BlueDriver, FIXD, ThinkCar, INNOVA, Bosch, Actron. Use null if not detectable.
- warning_lights: only from this set — "check_engine", "abs", "airbag_srs", "battery", "oil_pressure", "brake", "tpms". Use an empty array if none visible.
- emissions_status: "ready" if all monitors pass, "not_ready" if any monitor is incomplete or failing, "unknown" if not shown, null if not applicable.
- confidence: "high" if codes are clearly readable, "medium" if partially obscured or inferred, "low" if very hard to read.
- notes: brief string for anything relevant not captured above (e.g. "scan shows freeze frame data"), or null.
- If no codes are present, return an empty "codes" array — do not invent codes.
- Do NOT diagnose, recommend repairs, or recommend purchase decisions.`;

function systemFromCode(code: string): string {
  const prefix = code.toUpperCase().charAt(0);
  return prefix === "P" ? "Powertrain"
       : prefix === "C" ? "Chassis"
       : prefix === "B" ? "Body"
       : prefix === "U" ? "Network"
       : "Unknown";
}

function parsePlainText(text: string): {
  codes: { system: string; code: string; status: string; description: string }[];
  scanner_brand: string | null;
  warning_lights: string[];
  emissions_status: string | null;
  confidence: string;
  notes: string | null;
} {
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
  const scanner_brand = brandMatch ? brandMatch[1].charAt(0).toUpperCase() + brandMatch[1].slice(1).toLowerCase() : null;

  const notReady = /not[\s_-]?ready|incomplete|failing/i.test(text);
  const ready = /\bready\b/i.test(text) && !notReady;
  const emissions_status = notReady ? "not_ready" : ready ? "ready" : null;

  const warning_lights: string[] = [];
  if (/check[\s_-]?engine/i.test(text)) warning_lights.push("check_engine");
  if (/\babs\b/i.test(text)) warning_lights.push("abs");
  if (/airbag|srs/i.test(text)) warning_lights.push("airbag_srs");

  return {
    codes,
    scanner_brand,
    warning_lights,
    emissions_status,
    confidence: codes.length > 0 ? "medium" : "low",
    notes: null,
  };
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

    if (isTxt || isCsv) {
      const text = await fileRes.text();
      const result = parsePlainText(text);
      return NextResponse.json({ ...result, method: "text_parse" });
    }

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
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp";
      content = [
        {
          type: "image",
          source: { type: "base64", media_type: mimeType, data: base64 },
        },
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

    return NextResponse.json({ ...parsed, method: isPdf ? "claude_pdf" : "claude_vision" });
  } catch (err) {
    console.error("[obd/extract]", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
