export function reportReadyHtml({
  orderId,
  customerName,
  vehicleYear,
  vehicleMake,
  vehicleModel,
}: {
  orderId: string;
  customerName: string;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h1 style="color:#2563eb;margin-bottom:24px;">Your Intelligence Report is Ready</h1>
      <p>Hi ${customerName},</p>
      <p>The intelligence report for your <strong>${vehicleYear} ${vehicleMake} ${vehicleModel}</strong> is now available.</p>
      <a href="${appUrl}/orders/${orderId}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">View Report</a>
      <p style="margin-top:16px;color:#64748b;">You can download the full PDF report from your order page.</p>
      <p style="color:#64748b;font-size:12px;margin-top:32px;">RideCheck - Pre-Car-Purchase Intelligence</p>
    </div>
  `;
}
