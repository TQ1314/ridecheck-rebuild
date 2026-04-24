import { NextRequest, NextResponse } from "next/server";
import { classifyVehicleInternal } from "@/lib/vehicleClassification.server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import type { ClassificationInput } from "@/lib/vehicleClassification";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  const limit = checkRateLimit(clientKey);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const body = await req.json();
    const input: ClassificationInput = {
      make: String(body.make || ""),
      model: String(body.model || ""),
      year: Number(body.year) || new Date().getFullYear(),
      mileage: body.mileage != null ? Number(body.mileage) : null,
      askingPrice: body.askingPrice != null ? Number(body.askingPrice) : null,
    };

    if (!input.make || !input.model) {
      return NextResponse.json(
        { tier: "standard", price: 139, requiresUpgrade: false },
        { headers: { "X-RateLimit-Remaining": String(limit.remaining) } }
      );
    }

    const result = classifyVehicleInternal(input);

    const rawIp = clientKey.replace("ip:", "");
    const ipHash = crypto.createHash("sha256").update(rawIp).digest("hex").slice(0, 16);

    Promise.resolve(
      supabaseAdmin
        .from("vehicle_classification_signals")
        .insert({
          ip_hash: ipHash,
          make: input.make.toLowerCase().trim(),
          model: input.model.toLowerCase().trim(),
          year: input.year,
          mileage: input.mileage ?? null,
          asking_price: input.askingPrice ?? null,
          tier_result: result.packageTier,
          signals_triggered: result.signals_triggered,
          risk_flags: result.risk_flags,
        })
    ).catch(() => {});

    return NextResponse.json(
      {
        tier: result.packageTier,
        price: result.basePrice,
        requiresUpgrade: result.requiresUpgrade,
      },
      { headers: { "X-RateLimit-Remaining": String(limit.remaining) } }
    );
  } catch {
    return NextResponse.json(
      { tier: "standard", price: 139, requiresUpgrade: false },
      { headers: { "X-RateLimit-Remaining": String(limit.remaining) } }
    );
  }
}
