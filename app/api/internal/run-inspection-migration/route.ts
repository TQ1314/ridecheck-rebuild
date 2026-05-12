import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorized } from "@/lib/rbac";
import { runInspectionMigration } from "@/lib/inspection/runMigration";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const result = await requireRole(["owner", "admin"]);
  if (!isAuthorized(result)) return result.error;

  const outcome = await runInspectionMigration();

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: outcome.message });
}
