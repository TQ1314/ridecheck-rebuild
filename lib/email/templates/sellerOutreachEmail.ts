/**
 * Branded seller outreach email template.
 *
 * Wraps the plain-text message body (from templates.ts) in the shared
 * branded layout, adding a vehicle summary card and a trust section.
 * Source-aware: marketplace / dealership / roadside.
 */

import { brandedEmailLayout } from "./brandedEmailLayout";

export interface SellerOutreachEmailParams {
  messageBody:     string;
  vehicleYear?:    number | null;
  vehicleMake?:    string | null;
  vehicleModel?:   string | null;
  listingSource?:  string | null;
  preferredDate?:  string | null;
  attemptNumber?:  number;
}

function messageParagraphs(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line.trim()
        ? `<p style="margin:0 0 14px 0;">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
        : ""
    )
    .filter(Boolean)
    .join("\n");
}

function trustSection(listingSource?: string | null): string {
  const isDealership = listingSource === "dealership";

  const points = isDealership
    ? [
        "Performed at your dealership — no disruption to your sales floor",
        "No obligation to close the sale or negotiate",
        "Independent third-party documentation that serious buyers trust",
        "Works around your business hours — we schedule around you",
      ]
    : [
        "Performed at your location — no towing or drop-off required",
        "No obligation to sell — inspection does not commit you to anything",
        "Independent documentation that helps serious buyers move forward",
        "Quick and non-invasive — no disassembly or modifications",
      ];

  const bullets = points
    .map(
      (p) =>
        `<tr>
          <td style="width:22px; padding:6px 0; vertical-align:top; color:#16a34a; font-size:16px;">&#10003;</td>
          <td style="padding:6px 0; font-size:14px; color:#1e293b; line-height:1.5;">${p}</td>
        </tr>`
    )
    .join("\n");

  const heading = isDealership
    ? "Why Dealerships Work With RideCheck"
    : "What to Expect — Seller FAQ";

  return `
<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;
            padding:20px 22px; margin:20px 0 8px;">
  <p style="margin:0 0 12px; font-weight:700; color:#166534; font-size:14px;">
    ${heading}
  </p>
  <table cellpadding="0" cellspacing="0" width="100%">
    ${bullets}
  </table>
</div>`;
}

function locationTypeLabel(listingSource?: string | null): string {
  switch (listingSource) {
    case "dealership": return "Dealership / Lot";
    case "roadside":   return "Roadside / Your Location";
    default:           return "Seller Location";
  }
}

function titleForSource(
  listingSource?: string | null,
  attemptNumber?: number
): string {
  const attempt = attemptNumber ?? 1;
  if (attempt === 2) return "Follow-Up: Pre-Purchase Inspection Request";
  if (attempt >= 3) return "Final Follow-Up: Pre-Purchase Inspection";

  switch (listingSource) {
    case "dealership": return "Vehicle Inspection Request — Your Dealership";
    case "roadside":   return "Pre-Purchase Inspection Request";
    default:           return "Pre-Purchase Inspection Request";
  }
}

export function sellerOutreachEmailHtml(p: SellerOutreachEmailParams): string {
  const bodyHtml = `
${messageParagraphs(p.messageBody)}
${trustSection(p.listingSource)}
`;

  return brandedEmailLayout({
    title: titleForSource(p.listingSource, p.attemptNumber),

    vehicleSummary: {
      year:            p.vehicleYear  ?? undefined,
      make:            p.vehicleMake  ?? undefined,
      model:           p.vehicleModel ?? undefined,
      inspectionType:  "Pre-Purchase Inspection",
      preferredDate:   p.preferredDate ? `On or around ${p.preferredDate}` : undefined,
      estimatedLength: "30–45 minutes",
      locationType:    locationTypeLabel(p.listingSource),
    },

    bodyHtml,

    footerNote:
      "Please reply directly to this email to confirm availability.",

    footerDisclaimer:
      "This message was sent by RideCheck Operations on behalf of a vehicle buyer regarding a pre-purchase inspection request.",
  });
}
