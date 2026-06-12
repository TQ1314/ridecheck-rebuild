/**
 * Branded email template for RideChecker job offer notifications.
 * Sent when a job is broadcast to one or more RideCheckers.
 */

import { brandedEmailLayout } from "./brandedEmailLayout";

export interface RidecheckerJobOfferParams {
  firstName:     string;
  offeredPay:    number;
  vehicleYear?:  number | null;
  vehicleMake?:  string | null;
  vehicleModel?: string | null;
  orderId?:      string | null;
  dashboardUrl:  string;
}

export function ridecheckerJobOfferHtml(p: RidecheckerJobOfferParams): string {
  const vehicleLabel = [p.vehicleYear, p.vehicleMake, p.vehicleModel]
    .filter(Boolean)
    .join(" ") || "Vehicle TBD";

  const bodyHtml = `
<p style="margin:0 0 14px; color:#1e293b;">Hi ${p.firstName},</p>
<p style="margin:0 0 14px; color:#475569; line-height:1.7;">
  A new vehicle assessment job has been sent to you. Log in to your RideCheck dashboard
  to view the full details, accept, or decline.
</p>
<p style="margin:0 0 6px; color:#1e293b; font-size:14px;">
  <strong>Offered pay:</strong>
  <span style="font-size:22px; font-weight:800; color:#22774F;">$${p.offeredPay}</span>
</p>
<p style="margin:0 0 20px; font-size:13px; color:#64748b;">
  First to accept wins the job — act quickly.
</p>
<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;
            padding:16px 20px; margin:0 0 8px;">
  <p style="margin:0 0 6px; font-size:13px; font-weight:600; color:#166534;">Job Details</p>
  <table cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="font-size:13px; color:#475569; padding:4px 0; width:40%;">Vehicle</td>
      <td style="font-size:13px; color:#1e293b; font-weight:600; padding:4px 0;">${vehicleLabel}</td>
    </tr>
    ${p.orderId ? `<tr>
      <td style="font-size:13px; color:#475569; padding:4px 0;">Order</td>
      <td style="font-size:13px; color:#1e293b; padding:4px 0;">${p.orderId}</td>
    </tr>` : ""}
    <tr>
      <td style="font-size:13px; color:#475569; padding:4px 0;">Pay Offered</td>
      <td style="font-size:13px; color:#1e293b; font-weight:700; padding:4px 0;">$${p.offeredPay}</td>
    </tr>
    <tr>
      <td style="font-size:13px; color:#475569; padding:4px 0;">Action Required</td>
      <td style="font-size:13px; color:#dc2626; font-weight:600; padding:4px 0;">Accept or Decline via Dashboard</td>
    </tr>
  </table>
</div>`;

  return brandedEmailLayout({
    title:    "New Job Available — Quick Response Needed",
    subtitle: "A vehicle assessment job has been sent to you",

    bodyHtml,

    callToAction: {
      url:   p.dashboardUrl,
      label: "View &amp; Accept Job",
    },

    footerDisclaimer:
      "This message was sent by RideCheck Operations. You are receiving this because you are an active RideChecker in our network.",
  });
}
