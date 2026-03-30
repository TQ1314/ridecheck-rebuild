const GREEN = "#1a6b45";
const BRAND = "RideCheck";

export function ridecheckerApprovedHtml({
  name,
  setupUrl,
}: {
  name: string;
  setupUrl: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <div style="margin-bottom:24px;">
        <span style="font-size:20px;font-weight:700;color:${GREEN};">${BRAND}</span>
      </div>
      <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#111;">
        You've been approved as a RideChecker!
      </h1>
      <p style="margin-bottom:16px;">Hi ${name},</p>
      <p style="margin-bottom:16px;">
        Congratulations — your application has been <strong>approved</strong>. You are now part of
        the ${BRAND} field team as a certified RideChecker.
      </p>
      <p style="margin-bottom:24px;">
        Click the button below to complete your onboarding setup. This link is unique to you
        and expires in 72 hours.
      </p>
      <a href="${setupUrl}"
         style="display:inline-block;background:${GREEN};color:#fff;padding:14px 28px;
                border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
        Complete Onboarding
      </a>
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;">
        <p style="font-size:13px;color:#6b7280;margin-bottom:8px;"><strong>What happens next:</strong></p>
        <ul style="font-size:13px;color:#374151;padding-left:18px;line-height:1.7;">
          <li>Complete your profile and onboarding checklist</li>
          <li>Vehicle assessment jobs in your area will appear on your dashboard</li>
          <li>Complete assessments and submit reports through the ${BRAND} app</li>
          <li>Earn per completed and approved assessment</li>
        </ul>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin-top:32px;">
        If you did not apply to be a RideChecker, you can safely ignore this email.<br/>
        ${BRAND} &mdash; Pre-Car-Purchase Intelligence
      </p>
    </div>
  `;
}

export function ridecheckerRejectedHtml({
  name,
  reason,
}: {
  name: string;
  reason?: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <div style="margin-bottom:24px;">
        <span style="font-size:20px;font-weight:700;color:${GREEN};">${BRAND}</span>
      </div>
      <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#111;">
        RideChecker Application Update
      </h1>
      <p style="margin-bottom:16px;">Hi ${name},</p>
      <p style="margin-bottom:16px;">
        Thank you for your interest in joining the ${BRAND} field team. After reviewing your
        application, we are unable to move forward at this time.
      </p>
      ${reason ? `<p style="background:#f9fafb;border-left:3px solid #d1d5db;padding:12px 16px;font-size:14px;color:#374151;"><strong>Feedback:</strong> ${reason}</p>` : ""}
      <p style="margin-top:16px;">
        If your circumstances change in the future, we encourage you to reapply. You're also
        welcome to reach out to our team with any questions.
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:32px;">
        ${BRAND} &mdash; Pre-Car-Purchase Intelligence
      </p>
    </div>
  `;
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

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <div style="margin-bottom:24px;">
        <span style="font-size:20px;font-weight:700;color:${GREEN};">${BRAND}</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;margin-bottom:8px;color:#111;">
        Application Status Update
      </h1>
      <p style="margin-bottom:16px;">Hi ${name},</p>
      <p style="margin-bottom:16px;">
        Your RideChecker application status has been updated to:
        <strong>${label}</strong>
      </p>
      ${notes ? `<p style="background:#f9fafb;border-left:3px solid #d1d5db;padding:12px 16px;font-size:14px;color:#374151;">${notes}</p>` : ""}
      <p style="margin-top:16px;font-size:13px;color:#6b7280;">
        Our team will be in touch with next steps. If you have any questions, reply to this email.
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:32px;">
        ${BRAND} &mdash; Pre-Car-Purchase Intelligence
      </p>
    </div>
  `;
}
