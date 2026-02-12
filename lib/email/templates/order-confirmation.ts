export function orderConfirmationHtml({
  orderId,
  customerName,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  packageName,
  finalPrice,
  bookingType,
}: {
  orderId: string;
  customerName: string;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  packageName: string;
  finalPrice: string;
  bookingType: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h1 style="color:#2563eb;margin-bottom:24px;">Order Confirmed</h1>
      <p>Hi ${customerName},</p>
      <p>Your RideCheck assessment order has been received!</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Order ID</td><td style="padding:8px;border-bottom:1px solid #eee;">${orderId}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Vehicle</td><td style="padding:8px;border-bottom:1px solid #eee;">${vehicleYear} ${vehicleMake} ${vehicleModel}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Package</td><td style="padding:8px;border-bottom:1px solid #eee;">${packageName}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Total</td><td style="padding:8px;border-bottom:1px solid #eee;">$${finalPrice}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Booking Type</td><td style="padding:8px;border-bottom:1px solid #eee;">${bookingType === "self_arrange" ? "Self-Arranged" : "Concierge"}</td></tr>
      </table>
      ${bookingType === "self_arrange" ? "<p>Please complete payment to proceed with your vehicle assessment.</p>" : "<p>Our team will contact the seller and reach out to you once the appointment is confirmed.</p>"}
      <a href="${appUrl}/orders/${orderId}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">View Order</a>
      <p style="color:#64748b;font-size:12px;margin-top:32px;">RideCheck - Pre-Car-Purchase Intelligence</p>
    </div>
  `;
}
