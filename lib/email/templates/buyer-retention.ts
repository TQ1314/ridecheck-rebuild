const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";

export interface BuyerRetentionEmailParams {
  buyerName: string;
  vehicleYear?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  orderId: string;
  creditExpiresAt?: string;
}

export function buyerRetentionHtml(p: BuyerRetentionEmailParams): string {
  const vehicleStr =
    p.vehicleYear && p.vehicleMake && p.vehicleModel
      ? `${p.vehicleYear} ${p.vehicleMake} ${p.vehicleModel}`
      : "the listed vehicle";

  const transferUrl = `${APP_URL}/orders/${p.orderId}/transfer`;
  const expiryNote = p.creditExpiresAt
    ? `<p style="margin:8px 0 0;color:#888;font-size:12px;">Your RideCheck credit expires on ${new Date(p.creditExpiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.</p>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="background:#1a1a2e;padding:20px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">RideCheck</p>
          <p style="margin:4px 0 0;color:#aaa;font-size:12px;">Important Update</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;">The seller declined inspection access.</h2>
          <p style="color:#444;line-height:1.6;">
            The seller of <strong>${vehicleStr}</strong> declined independent inspection access.
          </p>
          <p style="color:#444;line-height:1.6;margin-top:12px;">
            This does not automatically mean the vehicle has a problem — but many buyers consider
            a refusal an important signal before moving forward.
          </p>

          <!-- Retention Banner -->
          <table cellpadding="0" cellspacing="0" style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:20px;margin:24px 0;width:100%;">
            <tr><td>
              <p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:#3730a3;">Your RideCheck remains active.</p>
              <p style="margin:0;color:#4338ca;line-height:1.5;">
                You can apply it to another vehicle instead of starting over.
                No additional payment required for the same package.
              </p>
              ${expiryNote}
            </td></tr>
          </table>

          <!-- CTAs -->
          <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px;">
            <tr>
              <td style="padding-right:8px;">
                <a href="${transferUrl}"
                   style="display:block;text-align:center;background:#4a6cf7;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
                  Inspect Another Vehicle
                </a>
              </td>
            </tr>
          </table>

          <p style="color:#888;font-size:13px;margin-top:20px;">
            You can also <a href="${APP_URL}/orders/${p.orderId}" style="color:#4a6cf7;">view your order</a>
            to request a refund or contact our support team for help.
          </p>

          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="color:#aaa;font-size:12px;">
            RideCheck · <a href="mailto:support@ridecheckauto.com" style="color:#4a6cf7;">support@ridecheckauto.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buyerRetentionSms(p: BuyerRetentionEmailParams): string {
  const vehicleStr =
    p.vehicleYear && p.vehicleMake && p.vehicleModel
      ? `${p.vehicleYear} ${p.vehicleMake} ${p.vehicleModel}`
      : "the listed vehicle";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
  return (
    `RideCheck update: The seller of ${vehicleStr} declined inspection. ` +
    `Your RideCheck credit is still active — use it on another vehicle at no extra cost. ` +
    `Transfer here: ${appUrl}/orders/${p.orderId}/transfer`
  );
}
