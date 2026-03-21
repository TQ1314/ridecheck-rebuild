import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const schema = z.object({
  listingUrl: z.string().url("Must be a valid URL"),
  name: z.string().max(100).optional(),
  contact: z.string().max(200).optional(),
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message || "Validation error" },
      { status: 422 }
    );
  }

  const { listingUrl, name, contact } = result.data;

  const toEmail = process.env.ADMIN_EMAIL || process.env.RESEND_FROM_EMAIL || "support@ridecheckauto.com";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ridecheckauto.com";

  try {
    await resend.emails.send({
      from: `RideCheck Blog <${fromEmail}>`,
      to: toEmail,
      subject: "New Blog Lead — Listing Submitted",
      html: `
        <h2>New blog lead submission</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr>
            <td style="padding:8px 12px;font-weight:bold;background:#f3f4f6">Listing URL</td>
            <td style="padding:8px 12px"><a href="${listingUrl}">${listingUrl}</a></td>
          </tr>
          ${name ? `<tr><td style="padding:8px 12px;font-weight:bold;background:#f3f4f6">Name</td><td style="padding:8px 12px">${name}</td></tr>` : ""}
          ${contact ? `<tr><td style="padding:8px 12px;font-weight:bold;background:#f3f4f6">Contact</td><td style="padding:8px 12px">${contact}</td></tr>` : ""}
          <tr>
            <td style="padding:8px 12px;font-weight:bold;background:#f3f4f6">Source</td>
            <td style="padding:8px 12px">RideCheck Blog</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:bold;background:#f3f4f6">Submitted</td>
            <td style="padding:8px 12px">${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</td>
          </tr>
        </table>
        <p style="margin-top:16px;color:#6b7280;font-size:12px">
          This lead came from a blog post CTA on ridecheckauto.com. Follow up to schedule a pre-purchase inspection.
        </p>
      `,
    });
  } catch (err) {
    console.error("[blog/lead] Resend error:", err);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
