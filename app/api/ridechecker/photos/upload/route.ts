import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET        = "ridechecker-photos";
const MAX_SIZE      = 20 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg", "image/jpg", "image/png",
  "image/webp", "image/heic", "image/heif",
  "application/pdf",
  "text/plain", "text/csv", "application/csv",
];

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker_active", "owner", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData     = await req.formData();
    const file         = formData.get("file") as File | null;
    const assignmentId = (formData.get("assignmentId") as string) || "misc";
    const orderId      = (formData.get("orderId")      as string) || "";
    const stepKey      = (formData.get("stepKey")      as string) || "unknown";
    const slotKey      = (formData.get("slotKey")      as string) || "photo";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
    }

    const mimeType = file.type || "image/jpeg";
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, WebP, HEIC, PDF, TXT, or CSV." },
        { status: 400 },
      );
    }

    // ── Ensure bucket exists ────────────────────────────────────────────────
    try {
      await supabaseAdmin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
    } catch {
      // Bucket likely already exists — safe to ignore
    }

    // ── Structured storage path ─────────────────────────────────────────────
    // Preferred:  orders/{orderId}/assignments/{assignmentId}/{stepKey}/{slotKey}_{ts}.jpg
    // Fallback:   {userId}/{assignmentId}/{ts}.jpg  (legacy, if no orderId)
    const ext = file.name.split(".").pop()
      ?.toLowerCase()
      .replace("heic", "jpg")
      .replace("heif", "jpg") || "jpg";

    const ts = Date.now();
    const storagePath = orderId
      ? `orders/${orderId}/assignments/${assignmentId}/${stepKey}/${slotKey}_${ts}.${ext}`
      : `${session.user.id}/${assignmentId}/${ts}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error("[photo upload]", uploadError);
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

    return NextResponse.json({ url: publicUrl, path: storagePath });
  } catch (err) {
    console.error("[photo upload]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
