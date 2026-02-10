export function paymentRequestHtml({
  orderId,
  customerName,
  finalPrice,
  paymentUrl,
}: {
  orderId: string;
  customerName: string;
  finalPrice: string;
  paymentUrl: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h1 style="color:#2563eb;margin-bottom:24px;">Payment Required</h1>
      <p>Hi ${customerName},</p>
      <p>Great news! The seller has confirmed the appointment for your vehicle inspection (Order ${orderId}).</p>
      <p>Please complete the payment of <strong>$${finalPrice}</strong> to finalize scheduling.</p>
      <a href="${paymentUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">Pay Now</a>
      <p style="color:#64748b;font-size:12px;margin-top:32px;">RideCheck - Professional Pre-Purchase Vehicle Inspections</p>
    </div>
  `;
}
