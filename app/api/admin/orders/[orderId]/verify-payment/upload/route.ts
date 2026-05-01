import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, isAuthorized } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const BUCKET = "payment-evidence";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const result = await requireRole(["owner", "operations_lead"]);
    if (!isAuthorized(result)) return result.error;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Use JPEG, PNG, WebP, GIF, or PDF." },
        { status: 400 }
      );
    }

    const maxSizeMB = 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSizeMB}MB.` },
        { status: 400 }
      );
    }

    // Ensure bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const storagePath = `${params.orderId}/${Date.now()}-evidence.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("[Evidence Upload] Storage error", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err: any) {
    console.error("[Evidence Upload Error]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
