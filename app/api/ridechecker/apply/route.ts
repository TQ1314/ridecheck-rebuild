// app/api/ridechecker/apply/route.ts
// Creates a ridechecker_applications record without creating an auth account.
// No session required — this is a public endpoint.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const VALID_AVAILABILITY = [
  "weekdays",
  "weekends",
  "weekdays_and_weekends",
  "flexible",
  "mornings",
  "evenings",
];

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const full_name  = typeof body.full_name  === "string" ? body.full_name.trim() : "";
    const email      = typeof body.email      === "string" ? body.email.toLowerCase().trim() : "";
    const phone      = typeof body.phone      === "string" ? body.phone.trim() || null : null;
    const city       = typeof body.city       === "string" ? body.city.trim() || null : null;
    const experience = typeof body.experience === "string" ? body.experience.trim().slice(0, 2000) || null : null;
    const notes      = typeof body.notes      === "string" ? body.notes.trim().slice(0, 1000) || null : null;
    const availability = typeof body.availability === "string" && VALID_AVAILABILITY.includes(body.availability)
      ? body.availability
      : null;
    const willing_to_use_tools = typeof body.willing_to_use_tools === "boolean"
      ? body.willing_to_use_tools
      : null;

    if (!full_name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (full_name.length > 120) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    }

    // Check for duplicate email (pending or under review)
    const { data: existing } = await supabaseAdmin
      .from("ridechecker_applications")
      .select("id, status")
      .eq("email", email)
      .in("status", ["submitted", "under_review"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "An application from this email is already under review." },
        { status: 409 }
      );
    }

    const { data: application, error: insertError } = await supabaseAdmin
      .from("ridechecker_applications")
      .insert({
        full_name,
        email,
        phone,
        city,
        experience,
        notes,
        availability,
        willing_to_use_tools,
        status: "submitted",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[apply] Insert error:", insertError.message);
      return NextResponse.json({ error: "Failed to submit application. Please try again." }, { status: 500 });
    }

    // Notify admin via email (best-effort — never block the response)
    try {
      const { sendEmail } = await import("@/lib/notifications/email");
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `New RideChecker Application — ${full_name}`,
          html: `<p>A new RideChecker application was submitted.</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:4px 8px;font-weight:bold">Name</td><td style="padding:4px 8px">${full_name}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Email</td><td style="padding:4px 8px">${email}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Phone</td><td style="padding:4px 8px">${phone ?? "—"}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">City</td><td style="padding:4px 8px">${city ?? "—"}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Availability</td><td style="padding:4px 8px">${availability ?? "—"}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Willing to use tools</td><td style="padding:4px 8px">${willing_to_use_tools === true ? "Yes" : willing_to_use_tools === false ? "No" : "—"}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Experience</td><td style="padding:4px 8px">${experience ?? "—"}</td></tr>
</table>
<p style="margin-top:16px">Review in admin: ${getAppUrl()}/admin/applications</p>`,
        });
      }
    } catch (emailErr) {
      console.error("[apply] Admin notification error:", emailErr);
    }

    return NextResponse.json({ success: true, application_id: application.id });
  } catch (err: any) {
    console.error("[apply] Unexpected error:", err?.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
