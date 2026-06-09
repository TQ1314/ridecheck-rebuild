const SUPPORT_CONTACT = "support@ridecheckauto.com";
const FALLBACK_LOGO = "https://www.ridecheckauto.com/logo.png";

export interface SellerTrustEmailParams {
  ridecheckerFirstName: string;
  ridecheckerPhotoUrl?: string | null;
  ridecheckerRating?: number | null;
  ridecheckerCompletedInspections?: number | null;
  etaText?: string | null;
  vehicleYear?: number;
  vehicleMake?: string;
  vehicleModel?: string;
}

export function sellerTrustConfirmationHtml(p: SellerTrustEmailParams): string {
  const photoSrc = p.ridecheckerPhotoUrl || FALLBACK_LOGO;
  const ratingText = p.ridecheckerRating ? `${p.ridecheckerRating.toFixed(1)} ★` : null;
  const inspText = p.ridecheckerCompletedInspections
    ? `${p.ridecheckerCompletedInspections} inspection${p.ridecheckerCompletedInspections !== 1 ? "s" : ""} completed`
    : null;
  const etaLine = p.etaText
    ? `<p style="margin:8px 0;color:#555;"><strong>Expected arrival:</strong> ${p.etaText}</p>`
    : "";
  const statsLine =
    ratingText || inspText
      ? `<p style="margin:8px 0;color:#555;font-size:13px;">${[ratingText, inspText].filter(Boolean).join(" · ")}</p>`
      : "";
  const vehicleLine =
    p.vehicleYear && p.vehicleMake && p.vehicleModel
      ? `<p style="margin:8px 0;color:#777;font-size:13px;">Vehicle: ${p.vehicleYear} ${p.vehicleMake} ${p.vehicleModel}</p>`
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
          <p style="margin:4px 0 0;color:#aaa;font-size:12px;">Inspection Confirmation</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:22px;">Your inspection is confirmed.</h2>
          ${vehicleLine}

          <!-- RC Profile Card -->
          <table cellpadding="0" cellspacing="0" style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin:20px 0;width:100%;">
            <tr>
              <td style="width:72px;vertical-align:top;">
                <img src="${photoSrc}"
                  alt="${p.ridecheckerFirstName}"
                  width="64" height="64"
                  style="border-radius:50%;object-fit:cover;border:2px solid #ddd;" />
              </td>
              <td style="padding-left:16px;vertical-align:middle;">
                <p style="margin:0;font-size:17px;font-weight:bold;color:#1a1a2e;">Your RideChecker: ${p.ridecheckerFirstName}</p>
                ${statsLine}
                ${etaLine}
              </td>
            </tr>
          </table>

          <p style="color:#444;line-height:1.6;">RideCheck inspections are <strong>non-invasive</strong> and typically take <strong>45–75 minutes</strong>.</p>
          <p style="color:#444;line-height:1.6;margin-top:12px;">
            <strong>For your safety:</strong> Please verify the RideChecker's name and photo before granting vehicle access.
          </p>

          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="color:#888;font-size:12px;">
            Questions? Contact RideCheck support at
            <a href="mailto:${SUPPORT_CONTACT}" style="color:#4a6cf7;">${SUPPORT_CONTACT}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function sellerTrustConfirmationSms(p: SellerTrustEmailParams): string {
  const eta = p.etaText ? ` Expected arrival: ${p.etaText}.` : "";
  const stats: string[] = [];
  if (p.ridecheckerRating) stats.push(`${p.ridecheckerRating.toFixed(1)}★`);
  if (p.ridecheckerCompletedInspections) stats.push(`${p.ridecheckerCompletedInspections} inspections`);
  const statsStr = stats.length ? ` (${stats.join(", ")})` : "";

  return (
    `RideCheck inspection confirmed. Your inspector: ${p.ridecheckerFirstName}${statsStr}.${eta} ` +
    `Inspections are non-invasive (45–75 min). Verify name/photo before granting access. ` +
    `Questions? ${SUPPORT_CONTACT}`
  );
}
