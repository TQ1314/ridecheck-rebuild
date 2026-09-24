import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createIntakeSession, currentIntakeSession, setIntakeCookie, verifyIntakeSession } from "@/lib/booking-intake/session";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BUCKET = "booking-intake";
const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024;
const MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
function hasImageSignature(file: File, bytes: Uint8Array): boolean {
  if (file.type === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return bytes.length > 8 && bytes.slice(0, 8).every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i]);
  if (file.type === "image/webp") return bytes.length > 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function POST(req: NextRequest) {
  const uploadedPaths: string[] = [];
  try {
    const limit = checkRateLimit(`booking-intake-upload:${getClientKey(req)}`, 10);
    if (!limit.allowed) return NextResponse.json({ error: "Please wait before uploading more images." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    const existing = currentIntakeSession();
    const session = existing ? req.cookies.get("ridecheck_intake")!.value : createIntakeSession();
    const sessionId = verifyIntakeSession(session)!;
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length || files.length > MAX_FILES) return NextResponse.json({ error: "Upload between 1 and 5 images." }, { status: 400 });
    const { data: existingFiles, error: listError } = await supabaseAdmin.storage.from(BUCKET).list(sessionId, { limit: MAX_FILES + 1 });
    if (listError) throw listError;
    const existingBytes = (existingFiles ?? []).reduce((total, file) => total + Number((file.metadata as { size?: string } | null)?.size ?? 0), 0);
    const buffers: Array<{ file: File; buffer: Buffer; ext: string }> = [];
    const images: { id: string; name: string }[] = [];
    for (const file of files) {
      if (!MIME[file.type] || file.size > MAX_SIZE) return NextResponse.json({ error: "Only JPEG, PNG, or WebP images up to 5MB are allowed." }, { status: 400 });
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!hasImageSignature(file, buffer.subarray(0, 16))) return NextResponse.json({ error: "One or more files are not valid images." }, { status: 400 });
      const id = randomUUID();
      buffers.push({ file, buffer, ext: MIME[file.type] });
      images.push({ id, name: file.name.slice(0, 160) });
    }
    if ((existingFiles?.length ?? 0) + files.length > MAX_FILES || existingBytes + buffers.reduce((sum, item) => sum + item.buffer.length, 0) > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "This intake has reached its image limit." }, { status: 400 });
    }
    for (const [{ file, buffer, ext }, image] of buffers.map((entry, index) => [entry, images[index]] as const)) {
      const path = `${sessionId}/${image.id}.${ext}`;
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: false });
      if (error) throw error;
      uploadedPaths.push(path);
    }
    const response = NextResponse.json({ images });
    if (!existing) setIntakeCookie(response, session);
    return response;
  } catch (error) {
    if (uploadedPaths.length) await supabaseAdmin.storage.from(BUCKET).remove(uploadedPaths).catch(() => undefined);
    console.error("[booking-intake upload]", error);
    return NextResponse.json({ error: "Upload failed. Please try again or enter details manually." }, { status: 500 });
  }
}
