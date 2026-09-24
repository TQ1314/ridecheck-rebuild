import { isMarketplaceConcierge, isSelfArranged, publicOrderReference, sellerIntroduction, SELF_ARRANGE_MESSAGE } from "@/lib/order-journey";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

export function orderConfirmationHtml({
  orderNumber,
  customerName,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  packageName,
  finalPrice,
  bookingType,
  listingSource,
  trackUrl,
  payUrl,
}: {
  orderNumber: string | null;
  customerName: string;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  packageName: string;
  finalPrice: string;
  bookingType: string;
  listingSource: string | null;
  trackUrl?: string;
  payUrl?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const vehicleLabel = escapeHtml([vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(" "));
  const selfArrange = isSelfArranged(bookingType);
  const marketplace = isMarketplaceConcierge({ booking_type: bookingType, listing_source: listingSource });
  const sellerSection = selfArrange || marketplace
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 8px;font-weight:700;color:#166534;">${selfArrange ? "Coordinate access with the seller" : "Introduce RideCheck to the seller (optional)"}</p>
        <p>${selfArrange
          ? "You coordinate access and timing with the seller. Share the confirmed details with RideCheck."
          : "Optional: If you're already messaging the seller, you can send this introduction. RideCheck will handle the coordination after that."}</p>
        <div style="background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:16px;white-space:pre-line;line-height:1.6;">${escapeHtml(selfArrange ? SELF_ARRANGE_MESSAGE : sellerIntroduction({ vehicle_year: vehicleYear, vehicle_make: vehicleMake, vehicle_model: vehicleModel }))}</div>
      </div>`
    : "";

  const trackSection = trackUrl
    ? `<p style="margin-top:24px;"><a href="${appUrl}${trackUrl}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Track Your Order</a></p>`
    : "";

  const paySection = payUrl
    ? `<p style="margin-top:16px;"><a href="${payUrl}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Complete Payment</a></p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#059669;margin:0;">RideCheck</h1>
        <p style="color:#64748b;font-size:14px;margin:4px 0 0;">Independent Vehicle Inspection</p>
      </div>

      <h2 style="color:#1e293b;margin-bottom:16px;">Your Inspection Request</h2>
       <p>Hi ${escapeHtml(customerName)},</p>
      <p>Thanks for using RideCheck! Your order has been created.</p>
       <p>After you submit your request, we'll send you a secure payment link. Payment is required before RideCheck contacts the seller or schedules the inspection.</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f8fafc;border-radius:8px;">
        ${orderNumber ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Order</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(publicOrderReference(orderNumber)!)}</td></tr>` : ""}
        <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Vehicle</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${vehicleLabel}</td></tr>
        <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Package</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(packageName)}</td></tr>
        <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Price</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">$${escapeHtml(finalPrice)}</td></tr>
        <tr><td style="padding:10px 16px;font-weight:600;color:#475569;">Type</td><td style="padding:10px 16px;">${selfArrange ? "Self-Arranged" : "Concierge"}</td></tr>
      </table>

       <p>${selfArrange
         ? "You coordinate access and time with the seller. RideCheck will perform the inspection after payment and a confirmed appointment."
         : "Once payment is completed, RideCheck will begin coordinating with the seller to schedule your inspection."}</p>
       ${sellerSection}

      ${paySection}
      ${trackSection}

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;" />
      <p style="color:#94a3b8;font-size:12px;text-align:center;">RideCheck - Pre-Car-Purchase Intelligence<br/>Questions? Reply to this email or contact support@ridecheckauto.com</p>
    </div>
  `;
}
