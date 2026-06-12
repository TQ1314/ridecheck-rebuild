import { brandedEmailLayout } from "./brandedEmailLayout";

const BRAND = "RideCheck";

export function ridecheckerApprovedHtml({
  name,
  setupUrl,
}: {
  name: string;
  setupUrl: string;
}) {
  const firstName = name.split(" ")[0] || name;
  const bodyHtml = `
<p style="margin:0 0 14px; color:#1e293b;">Hi ${firstName},</p>
<p style="margin:0 0 14px; color:#475569; line-height:1.7;">
  Congratulations — your application has been <strong>approved</strong>.
  You are now part of the ${BRAND} field team as a certified RideChecker.
</p>
<p style="margin:0 0 20px; color:#475569; line-height:1.7;">
  Click the button below to complete your onboarding setup.
  This link is unique to you and <strong>expires in 72 hours</strong>.
</p>
<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;
            padding:18px 20px; margin:0 0 8px;">
  <p style="margin:0 0 10px; font-size:14px; font-weight:700; color:#166534;">What happens next:</p>
  <table cellpadding="0" cellspacing="0" width="100%">
    ${[
      "Complete your profile and onboarding checklist",
      "Vehicle assessment jobs in your area will appear on your dashboard",
      "Complete assessments and submit reports through the RideCheck app",
      "Earn per completed and approved assessment",
    ].map(item => `
    <tr>
      <td style="width:22px; padding:5px 0; vertical-align:top; color:#16a34a; font-size:15px;">&#10003;</td>
      <td style="padding:5px 0; font-size:14px; color:#1e293b; line-height:1.5;">${item}</td>
    </tr>`).join("")}
  </table>
</div>`;

  return brandedEmailLayout({
    title:    "You've Been Approved as a RideChecker!",
    bodyHtml,
    callToAction: { url: setupUrl, label: "Complete Onboarding" },
    footerDisclaimer:
      "If you did not apply to be a RideChecker, you can safely ignore this email.",
  });
}

export function ridecheckerRejectedHtml({
  name,
  reason,
}: {
  name: string;
  reason?: string;
}) {
  const firstName = name.split(" ")[0] || name;
  const bodyHtml = `
<p style="margin:0 0 14px; color:#1e293b;">Hi ${firstName},</p>
<p style="margin:0 0 14px; color:#475569; line-height:1.7;">
  Thank you for your interest in joining the ${BRAND} field team.
  After reviewing your application, we are unable to move forward at this time.
</p>
${reason ? `
<div style="background:#f8fafc; border-left:3px solid #d1d5db; padding:12px 16px;
            margin:0 0 14px; border-radius:0 4px 4px 0;">
  <p style="margin:0; font-size:14px; color:#374151; line-height:1.6;">
    <strong>Feedback:</strong> ${reason}
  </p>
</div>` : ""}
<p style="margin:0; color:#475569; line-height:1.7;">
  If your circumstances change in the future, we encourage you to reapply.
  You're also welcome to reach out with any questions.
</p>`;

  return brandedEmailLayout({
    title:    "RideChecker Application Update",
    bodyHtml,
    footerDisclaimer: `${BRAND} — Pre-Car-Purchase Intelligence`,
  });
}

export function ridecheckerStageUpdateHtml({
  name,
  toStage,
  notes,
}: {
  name: string;
  toStage: string;
  notes?: string;
}) {
  const stageLabel: Record<string, string> = {
    under_review:        "Under Review",
    docs_requested:      "Documents Requested",
    docs_received:       "Documents Received",
    background_pending:  "Background Check In Progress",
    background_clear:    "Background Check Cleared",
    reference_pending:   "Reference Check In Progress",
    assessment_pending:  "Assessment Pending",
    ready_for_approval:  "Ready for Final Approval",
  };
  const label = stageLabel[toStage] ?? toStage.replace(/_/g, " ");
  const firstName = name.split(" ")[0] || name;

  const bodyHtml = `
<p style="margin:0 0 14px; color:#1e293b;">Hi ${firstName},</p>
<p style="margin:0 0 14px; color:#475569; line-height:1.7;">
  Your RideChecker application status has been updated to:
</p>
<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;
            padding:14px 18px; margin:0 0 14px; text-align:center;">
  <p style="margin:0; font-size:18px; font-weight:700; color:#166534;">${label}</p>
</div>
${notes ? `
<div style="background:#f8fafc; border-left:3px solid #d1d5db; padding:12px 16px;
            margin:0 0 14px; border-radius:0 4px 4px 0;">
  <p style="margin:0; font-size:14px; color:#374151; line-height:1.6;">${notes}</p>
</div>` : ""}
<p style="margin:0; font-size:14px; color:#64748b; line-height:1.7;">
  Our team will be in touch with next steps. If you have any questions, reply to this email.
</p>`;

  return brandedEmailLayout({
    title:    "Application Status Update",
    bodyHtml,
    footerDisclaimer: `${BRAND} — Pre-Car-Purchase Intelligence`,
  });
}
