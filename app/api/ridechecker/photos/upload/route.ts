import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "ridechecker-photos";
const MAX_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const assignmentId = (formData.get("assignmentId") as string) || "misc";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 20MB)" },
        { status: 400 }
      );
    }

    const mimeType = file.type || "image/jpeg";
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, WebP, or HEIC." },
        { status: 400 }
      );
    }

    try {
      await supabaseAdmin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
    } catch {
    }

    const ext =
      file.name.split(".").pop()?.toLowerCase().replace("heic", "jpg").replace("heif", "jpg") ||
      "jpg";
    const storagePath = `${session.user.id}/${assignmentId}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[ridechecker photo upload error]", uploadError);
      return NextResponse.json(
        { error: "Upload failed. Please try again." },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

    return NextResponse.json({ url: publicUrl, path: storagePath });
  } catch (err: any) {
    console.error("[ridechecker photo upload error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
