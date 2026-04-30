const GREEN = "#22774F";

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
  const firstName = customerName.split(" ")[0] || customerName;
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:${GREEN};margin:0;font-size:26px;">RideCheck</h1>
        <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Pre-Car-Purchase Intelligence</p>
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
        <p style="font-size:18px;font-weight:700;color:#166534;margin:0 0 4px;">Payment Required to Confirm Your Inspection</p>
        <p style="color:#15803d;margin:0;font-size:14px;">Order ${orderId}</p>
      </div>

      <p style="color:#1e293b;font-size:15px;">Hi ${firstName},</p>
      <p style="color:#475569;line-height:1.6;">Great news — the seller has confirmed availability for your vehicle assessment. To lock in the appointment, please complete your payment of <strong style="color:#1e293b;">$${finalPrice}</strong>.</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f8fafc;border-radius:8px;">
        <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;width:40%;">Order</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;color:#1e293b;">${orderId}</td></tr>
        <tr><td style="padding:10px 16px;font-weight:600;color:#475569;">Amount Due</td><td style="padding:10px 16px;color:#1e293b;font-weight:700;font-size:16px;">$${finalPrice}</td></tr>
      </table>

      <p style="text-align:center;margin:28px 0;">
        <a href="${paymentUrl}" style="display:inline-block;background:${GREEN};color:#fff;padding:14px 36px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">Complete Payment →</a>
      </p>
      <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:8px;">Secure payment powered by Stripe. Your card details are never stored by RideCheck.</p>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;" />
      <p style="color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
        RideCheck — Pre-Car-Purchase Intelligence<br/>
        Questions? Contact us at <a href="mailto:support@ridecheckauto.com" style="color:${GREEN};">support@ridecheckauto.com</a>
      </p>
    </div>
  `;
}
