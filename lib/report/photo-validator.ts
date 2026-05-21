import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type PhotoStatus = "approved_for_report" | "excluded_ops_review";

export interface PhotoInput {
  url: string;
  label: string;
}

export interface PhotoValidationResult extends PhotoInput {
  status: PhotoStatus;
  reason: string;
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `You are a quality control reviewer for RideCheck, a vehicle inspection platform.

APPROVE ("approved_for_report") if the photo shows any of:
- Vehicle identification plate, VIN sticker, door jamb label
- Odometer, instrument cluster, dashboard gauges
- Dashboard warning lights or indicator display
- Engine bay, under-hood components, fluid caps, belts
- Underbody, frame rails, suspension, exhaust
- Brake calipers, rotors, pads, brake lines
- Tires (tread, sidewall, condition), wheels, rims
- Exterior body panels, glass, paint, dents, rust, damage
- Interior (seats, headliner, carpet, dashboard trim, condition)
- Mechanical components visible during inspection
- Road test environment or driving-related documentation

EXCLUDE ("excluded_ops_review") if the photo shows any of:
- A phone screen, tablet screen, laptop, or computer monitor
- A screenshot of a mobile app, web browser, or operating system UI
- A messaging app, SMS thread, email, or chat conversation
- Social media feed, post, profile, or story
- A listing or advertisement for the vehicle
- An image nearly identical to another photo in this set (duplicate)
- An image too blurry, dark, or obscured to identify vehicle content
- Anything unrelated to vehicle inspection (people, food, scenery, etc.)`;

export async function validatePhotos(
  photos: PhotoInput[]
): Promise<PhotoValidationResult[]> {
  const candidates = photos.filter((p) => !!p.url?.trim());
  if (candidates.length === 0) return [];

  const content: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: `${SYSTEM_PROMPT}

Review the ${candidates.length} photo(s) below. Return a JSON array — one entry per photo in the same order:
[{ "index": 0, "status": "approved_for_report" | "excluded_ops_review", "reason": "max 10 words" }]

Return ONLY the JSON array, no markdown.`,
    },
    ...candidates.flatMap((photo, i) => [
      { type: "text" as const, text: `Photo ${i + 1} — ${photo.label}:` },
      {
        type: "image" as const,
        source: { type: "url" as const, url: photo.url },
      },
    ]),
  ];

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "[]";
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```"))
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    const parsed = JSON.parse(cleaned) as Array<{
      index: number;
      status: PhotoStatus;
      reason: string;
    }>;

    return candidates.map((photo, i) => {
      const entry = parsed.find((r) => r.index === i);
      return {
        ...photo,
        status: entry?.status ?? "approved_for_report",
        reason: entry?.reason ?? "",
      };
    });
  } catch (err) {
    console.error("[photo-validator] validation failed, approving all:", err);
    return candidates.map((photo) => ({
      ...photo,
      status: "approved_for_report" as PhotoStatus,
      reason: "validation unavailable — defaulting to approved",
    }));
  }
}

export function partitionResults(results: PhotoValidationResult[]) {
  const approved = results.filter((r) => r.status === "approved_for_report");
  const excluded = results.filter((r) => r.status === "excluded_ops_review");
  return { approved, excluded };
}
