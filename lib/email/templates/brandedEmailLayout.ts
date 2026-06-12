/**
 * Shared branded email layout for all outgoing RideCheck emails.
 * Table-based for maximum email client compatibility (Gmail, Outlook, Apple Mail).
 */

const BRAND_GREEN   = "#22774F";
const BRAND_LIGHT   = "#f0fdf4";
const BRAND_BORDER  = "#bbf7d0";
const TEXT_DARK     = "#1e293b";
const TEXT_MID      = "#475569";
const TEXT_MUTED    = "#94a3b8";
const SUPPORT_EMAIL = "support@ridecheckauto.com";
const WEBSITE_URL   = "https://www.ridecheckauto.com";
const WEBSITE_LABEL = "RideCheckAuto.com";
const TAGLINE       = "Don&rsquo;t Buy Blind.";

export interface VehicleSummaryCard {
  year?:             number | null;
  make?:             string | null;
  model?:            string | null;
  inspectionType?:   string | null;
  preferredDate?:    string | null;
  estimatedLength?:  string | null;
  locationType?:     string | null;
}

export interface CallToAction {
  url:   string;
  label: string;
}

export interface BrandedEmailOptions {
  title:             string;
  subtitle?:         string | null;
  bodyHtml:          string;
  callToAction?:     CallToAction | null;
  vehicleSummary?:   VehicleSummaryCard | null;
  footerNote?:       string | null;
  footerDisclaimer?: string | null;
}

function vehicleCardHtml(v: VehicleSummaryCard): string {
  const rows: string[] = [];

  if (v.year || v.make || v.model) {
    const label = [v.year, v.make, v.model].filter(Boolean).join(" ");
    rows.push(row("Vehicle", `<strong>${label}</strong>`));
  }
  if (v.inspectionType) {
    rows.push(row("Inspection", v.inspectionType));
  }
  if (v.preferredDate) {
    rows.push(row("Requested Date", v.preferredDate));
  }
  if (v.estimatedLength) {
    rows.push(row("Estimated Length", v.estimatedLength));
  }
  if (v.locationType) {
    rows.push(row("Location Type", v.locationType));
  }

  if (rows.length === 0) return "";

  return `
<tr><td style="padding: 0 32px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0"
    style="background:${BRAND_LIGHT}; border:1px solid ${BRAND_BORDER}; border-radius:8px; overflow:hidden;">
    <tr><td style="padding:12px 18px; background:${BRAND_GREEN};">
      <p style="margin:0; color:#ffffff; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">
        Vehicle &amp; Inspection Details
      </p>
    </td></tr>
    ${rows.join("")}
  </table>
</td></tr>`;
}

function row(label: string, value: string): string {
  return `
<tr>
  <td style="padding:10px 18px; border-bottom:1px solid ${BRAND_BORDER}; font-size:13px;
             color:${TEXT_MID}; font-weight:600; width:45%; vertical-align:top;">
    ${label}
  </td>
  <td style="padding:10px 18px; border-bottom:1px solid ${BRAND_BORDER}; font-size:13px;
             color:${TEXT_DARK}; vertical-align:top;">
    ${value}
  </td>
</tr>`;
}

function ctaHtml(cta: CallToAction): string {
  return `
<tr><td style="padding: 8px 32px 28px; text-align:center;">
  <a href="${cta.url}"
     style="display:inline-block; background:${BRAND_GREEN}; color:#ffffff;
            padding:14px 36px; border-radius:6px; text-decoration:none;
            font-weight:700; font-size:15px;">
    ${cta.label}
  </a>
</td></tr>`;
}

export function brandedEmailLayout(opts: BrandedEmailOptions): string {
  const disclaimer = opts.footerDisclaimer ??
    "This message was sent by RideCheck Operations regarding a vehicle inspection request.";

  const footerExtra = opts.footerNote
    ? `<p style="color:${TEXT_MID}; font-size:13px; margin:0 0 16px; line-height:1.6;">${opts.footerNote}</p>`
    : "";

  const vehicleBlock = opts.vehicleSummary ? vehicleCardHtml(opts.vehicleSummary) : "";
  const ctaBlock     = opts.callToAction   ? ctaHtml(opts.callToAction)           : "";

  const subtitleLine = opts.subtitle
    ? `<p style="color:#bbf7d0; font-size:14px; margin:6px 0 0;">${opts.subtitle}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${opts.title}</title>
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0"
  style="background:#f1f5f9; padding:28px 16px;">
  <tr><td align="center">

    <table cellpadding="0" cellspacing="0"
      style="max-width:600px; width:100%; background:#ffffff; border-radius:10px;
             overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.07);">

      <!-- ── Header ── -->
      <tr><td style="background:${BRAND_GREEN}; padding:28px 32px; text-align:center;">
        <h1 style="margin:0; color:#ffffff; font-size:30px; font-weight:800; letter-spacing:-0.5px;">
          RideCheck
        </h1>
        <p style="margin:4px 0 0; color:#bbf7d0; font-size:13px;">
          Independent Vehicle Inspection Service
        </p>
        <p style="margin:8px 0 0; color:#dcfce7; font-size:15px; font-weight:600; font-style:italic;">
          ${TAGLINE}
        </p>
        ${subtitleLine}
      </td></tr>

      <!-- ── Title bar ── -->
      <tr><td style="background:${BRAND_LIGHT}; border-bottom:1px solid ${BRAND_BORDER};
                     padding:18px 32px; text-align:center;">
        <h2 style="margin:0; color:#166534; font-size:18px; font-weight:700; line-height:1.4;">
          ${opts.title}
        </h2>
      </td></tr>

      <!-- ── Vehicle summary card (optional) ── -->
      ${vehicleBlock}

      <!-- ── Body content ── -->
      <tr><td style="padding:${vehicleBlock ? "8px" : "28px"} 32px 24px;
                     color:${TEXT_DARK}; font-size:15px; line-height:1.7;">
        ${opts.bodyHtml}
      </td></tr>

      <!-- ── CTA button (optional) ── -->
      ${ctaBlock}

      <!-- ── Footer ── -->
      <tr><td style="background:#f8fafc; border-top:1px solid #e2e8f0;
                     padding:22px 32px; text-align:center;">
        ${footerExtra}
        <p style="color:${TEXT_MUTED}; font-size:12px; line-height:1.7; margin:0;">
          ${disclaimer}<br>
          <a href="${WEBSITE_URL}" style="color:${BRAND_GREEN}; text-decoration:none;">${WEBSITE_LABEL}</a>
          &nbsp;&middot;&nbsp;
          Questions?&nbsp;<a href="mailto:${SUPPORT_EMAIL}"
            style="color:${BRAND_GREEN}; text-decoration:none;">${SUPPORT_EMAIL}</a>
        </p>
      </td></tr>

    </table>

  </td></tr>
</table>

</body>
</html>`;
}
