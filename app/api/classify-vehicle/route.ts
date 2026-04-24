import { NextRequest, NextResponse } from "next/server";
import { classifyVehicle } from "@/lib/vehicleClassification.server";
import type { ClassificationInput } from "@/lib/vehicleClassification";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ tier: "standard", price: 139, requiresUpgrade: false });
    }

    const result = classifyVehicle(input);

    return NextResponse.json({
      tier: result.packageTier,
      price: result.basePrice,
      requiresUpgrade: result.requiresUpgrade,
    });
  } catch {
    return NextResponse.json({ tier: "standard", price: 139, requiresUpgrade: false });
  }
}
