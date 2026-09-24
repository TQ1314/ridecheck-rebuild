import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { lookup } from "dns/promises";
import { isIP } from "net";
import https from "https";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentIntakeSession } from "@/lib/booking-intake/session";
import { mergeFields, parseListingMetadata, validateExtracted, type IntakeFields } from "@/lib/booking-intake/extraction";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { isPrivateIntakeIp, isSafeIntakeUrl, intakeImageIdsRequireSession, isSessionImagePath } from "@/lib/booking-intake/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BUCKET = "booking-intake";
const MAX_HTML = 2 * 1024 * 1024;
type PinnedResponse = { statusCode: number; headers: Record<string, string | string[] | undefined>; body: Buffer };
async function pinnedHttpsGet(url: URL, ip: string): Promise<PinnedResponse> {
  return new Promise((resolve, reject) => {
    const request = https.request({
      protocol: "https:",
      hostname: url.hostname.replace(/^\[|\]$/g, ""),
      port: 443,
      path: `${url.pathname || "/"}${url.search}`,
      method: "GET",
      servername: url.hostname.replace(/^\[|\]$/g, ""),
      headers: { host: url.host, "user-agent": "RideCheck listing preview" },
      lookup: (_hostname, _options, callback) => callback(null, ip, isIP(ip) as 4 | 6),
    }, (response) => {
      const chunks: Buffer[] = []; let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_HTML) { request.destroy(new Error("response too large")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(8000, () => request.destroy(new Error("request timeout")));
    request.on("error", reject);
    request.end();
  });
}

async function fetchPublicPage(input: string): Promise<{ fields: IntakeFields; warning?: string }> {
  const initialUrl = isSafeIntakeUrl(input);
  if (!initialUrl) return { fields: {}, warning: "Please provide a public HTTPS listing URL." };
  let url: URL = initialUrl;
  for (let redirects = 0; redirects <= 3; redirects++) {
    try {
      const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true, verbatim: true });
      const publicAddress = addresses.find((record) => !isPrivateIntakeIp(record.address));
      if (!publicAddress || addresses.some((record) => isPrivateIntakeIp(record.address))) return { fields: {}, warning: "This listing host is not publicly reachable." };
      const response = await pinnedHttpsGet(url, publicAddress.address);
      if (response.statusCode >= 300 && response.statusCode < 400) {
        const location: string | null = Array.isArray(response.headers.location) ? response.headers.location[0] ?? null : response.headers.location ?? null;
        const next: URL | null = location ? isSafeIntakeUrl(new URL(location, url).toString()) : null;
        if (!next) return { fields: {}, warning: "This listing could not be read safely. Upload a screenshot or enter details manually." };
        url = next;
        continue;
      }
      const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
      if (response.statusCode < 200 || response.statusCode >= 300 || !contentType.includes("text/html")) return { fields: {}, warning: "We couldn't read this listing. Upload a screenshot or enter details manually." };
      const length = Number(response.headers["content-length"] || 0);
      if (length > MAX_HTML) return { fields: {}, warning: "This listing is too large to preview. Upload a screenshot or enter details manually." };
      return { fields: parseListingMetadata(response.body.toString("utf8"), input) };
    } catch { return { fields: {}, warning: "We couldn't read this listing. Upload a screenshot or enter details manually." }; }
  }
  return { fields: {}, warning: "This listing redirected too many times." };
}

async function extractImages(sessionId: string, ids: string[]): Promise<IntakeFields> {
  if (!process.env.ANTHROPIC_API_KEY || !ids.length) return {};
  const contents: Anthropic.ImageBlockParam[] = [];
  for (const id of ids.slice(0, 5)) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
    for (const ext of ["jpg", "png", "webp"]) {
      const path = `${sessionId}/${id}.${ext}`;
      if (!isSessionImagePath(sessionId, id, path)) continue;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
      if (!error && data) {
        const mediaType: "image/jpeg" | "image/png" | "image/webp" = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";
        contents.push({ type: "image", source: { type: "base64", media_type: mediaType, data: Buffer.from(await data.arrayBuffer()).toString("base64") } });
        break;
      }
    }
  }
  if (!contents.length) return {};
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = `Extract only facts explicitly visible in these vehicle listing images. Never guess. Return strict JSON object with only these keys and optional per-key evidence keys: year,make,model,trim,mileage,asking_price,location_text,service_zip,vin,seller_name,seller_phone,discovery_source,platform_source. Use numbers for year/mileage/asking_price. Omit unknown fields.`;
  const result = await client.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 900, system: "You extract literal vehicle listing facts. Never infer missing values.", messages: [{ role: "user", content: [...contents, { type: "text", text: prompt }] }] });
  const text = result.content.find((part) => part.type === "text")?.text ?? "";
  try { return validateExtracted(JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")), "uploaded_image", ids.join(",")); } catch { return {}; }
}

export async function POST(req: NextRequest) {
  try {
    const limit = checkRateLimit(`booking-intake-extract:${getClientKey(req)}`, 10);
    if (!limit.allowed) return NextResponse.json({ fields: {}, warning: "Please wait before trying extraction again." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    const body = await req.json();
    const urlInput = typeof body.url === "string" ? body.url.trim() : "";
    if (urlInput.length > 2048) return NextResponse.json({ fields: {}, warning: "Listing URL is too long." }, { status: 400 });
    const imageIds = Array.isArray(body.imageIds) ? body.imageIds : [];
    if (imageIds.length > 5 || imageIds.some((id: unknown) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
      return NextResponse.json({ fields: {}, warning: "Invalid image selection." }, { status: 400 });
    }
    const sessionId = currentIntakeSession();
    if (intakeImageIdsRequireSession(imageIds) && !sessionId) return NextResponse.json({ fields: {}, warning: "Upload an image first or continue with manual entry." }, { status: 401 });
    const fields: IntakeFields[] = [];
    let warning: string | undefined;
    if (urlInput) {
      const page = await fetchPublicPage(urlInput); fields.push(page.fields); warning = page.warning;
    }
    if (imageIds.length && sessionId) fields.push(await extractImages(sessionId, imageIds));
    const response: Record<string, unknown> = { fields: mergeFields(...fields) };
    if (warning) response.warning = warning;
    return NextResponse.json(response);
  } catch (error) {
    console.error("[booking-intake extract]", error);
    return NextResponse.json({ fields: {}, warning: "Extraction is unavailable. You can continue with manual entry." });
  }
}
