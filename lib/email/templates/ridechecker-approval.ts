export function ridecheckerApprovedHtml({
  name,
  loginUrl,
}: {
  name: string;
  loginUrl: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h1 style="color:#2563eb;margin-bottom:24px;">Welcome to the RideCheck Team!</h1>
      <p>Hi ${name},</p>
      <p>Great news - your RideChecker application has been <strong>approved</strong>!</p>
      <p>You are now an active RideChecker and can start receiving vehicle assessment jobs. Log in to your dashboard to see available assignments.</p>
      <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">Go to Dashboard</a>
      <p style="margin-top:24px;">What happens next:</p>
      <ul>
        <li>Jobs in your service area will appear on your dashboard</li>
        <li>Complete assessments and upload reports</li>
        <li>Earn per completed job</li>
      </ul>
      <p style="color:#64748b;font-size:12px;margin-top:32px;">RideCheck - Pre-Car-Purchase Intelligence</p>
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
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h1 style="color:#2563eb;margin-bottom:24px;">RideChecker Application Update</h1>
      <p>Hi ${name},</p>
      <p>Thank you for your interest in becoming a RideChecker. After reviewing your application, we are unable to approve it at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      <p>If you believe this was a mistake or your circumstances have changed, you are welcome to reach out to our team or reapply in the future.</p>
      <p style="color:#64748b;font-size:12px;margin-top:32px;">RideCheck - Pre-Car-Purchase Intelligence</p>
    </div>
  `;
}
