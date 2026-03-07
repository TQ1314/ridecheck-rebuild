const SELLER_MESSAGE = `Hi! Before I drive out to see the car, I usually have a mobile RideCheck inspector take a quick look. It takes about 30\u201345 minutes and helps me move fast if everything checks out. Would that be okay with you?`;

export function getSellerMessage() {
  return SELLER_MESSAGE;
}

export function orderConfirmationHtml({
  orderId,
  customerName,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  packageName,
  finalPrice,
  bookingType,
  trackUrl,
  payUrl,
}: {
  orderId: string;
  customerName: string;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  packageName: string;
  finalPrice: string;
  bookingType: string;
  trackUrl?: string;
  payUrl?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const vehicleLabel = `${vehicleYear} ${vehicleMake} ${vehicleModel}`;

  const nextStepsHtml = bookingType === "self_arrange"
    ? `<p style="margin:16px 0 8px;font-weight:600;">Next Step: Let the Seller Know</p>
       <p style="margin:0 0 8px;">Copy the message below and send it to the seller. It helps set expectations and reduces the chance of refusal:</p>`
    : `<p style="margin:16px 0 8px;">Our team will contact the seller to schedule the inspection. In the meantime, you can also send the seller a heads-up to make things go smoothly:</p>`;

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
      <p>Hi ${customerName},</p>
      <p>Thanks for using RideCheck! Your order has been created.</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f8fafc;border-radius:8px;">
        <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Order ID</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${orderId}</td></tr>
        <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Vehicle</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${vehicleLabel}</td></tr>
        <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Package</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${packageName}</td></tr>
        <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Price</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">$${finalPrice}</td></tr>
        <tr><td style="padding:10px 16px;font-weight:600;color:#475569;">Type</td><td style="padding:10px 16px;">${bookingType === "self_arrange" ? "Self-Arranged" : "Concierge"}</td></tr>
      </table>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 4px;font-weight:700;color:#166534;font-size:15px;">Message to Send to the Seller</p>
        ${nextStepsHtml}
        <div style="background:#ffffff;border:1px solid #d1d5db;border-radius:6px;padding:16px;margin:12px 0 0;font-style:italic;color:#374151;line-height:1.6;">
          ${SELLER_MESSAGE}
        </div>
        <p style="margin:12px 0 0;font-size:13px;color:#6b7280;">Copy and paste this message to the seller via text, Facebook Messenger, email, or however you are in contact with them.</p>
      </div>

      ${paySection}
      ${trackSection}

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;" />
      <p style="color:#94a3b8;font-size:12px;text-align:center;">RideCheck - Pre-Car-Purchase Intelligence<br/>Questions? Reply to this email or contact support@ridecheckauto.com</p>
    </div>
  `;
}
