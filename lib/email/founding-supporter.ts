const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";

const TIER_LABELS: Record<string, string> = {
  backer:           "The Backer",
  believer:         "The Believer",
  founding_partner: "Founding Partner",
};

const CREDIT_LABELS: Record<string, string> = {
  backer:           "1 Standard RideCheck Credit",
  believer:         "1 Standard RideCheck Credit",
  founding_partner: "2 Standard RideCheck Credits",
};

function base(content: string): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#059669;padding:24px;border-radius:8px 8px 0 0;text-align:center">
    <h1 style="color:white;margin:0;font-size:22px">RideCheck</h1>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:32px">
    ${content}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="margin:0;font-size:12px;color:#9ca3af">Questions? <a href="mailto:support@ridecheckauto.com" style="color:#059669">support@ridecheckauto.com</a></p>
  </div>
</div>`;
}

export function buildSupporterConfirmationEmail({
  name,
  tier,
  creditCode,
  creditsCount,
  expiresAt,
}: {
  name: string;
  tier: string;
  creditCode: string;
  creditsCount: number;
  expiresAt: string;
}): { subject: string; html: string } {
  const tierLabel   = TIER_LABELS[tier]  ?? tier;
  const creditLabel = CREDIT_LABELS[tier] ?? `${creditsCount} RideCheck Credit${creditsCount > 1 ? "s" : ""}`;
  const expDate     = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const html = base(`
    <p style="margin:0 0 16px">Hi ${name},</p>
    <p style="margin:0 0 16px">Thank you for becoming a Founding Supporter of RideCheck. Your support helps us build a safer used-car marketplace across Illinois.</p>
    <p style="margin:0 0 24px;font-size:14px;font-style:italic;color:#374151">— Harry, Founder of RideCheck</p>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin:0 0 24px;text-align:center">
      <p style="margin:0 0 6px;font-size:12px;color:#059669;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Your RideCheck Credit Code</p>
      <p style="margin:0 0 6px;font-size:26px;font-weight:700;letter-spacing:.08em;color:#064e3b;font-family:monospace">${creditCode}</p>
      <p style="margin:0;font-size:13px;color:#374151">${tierLabel} &middot; ${creditLabel}</p>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;font-weight:700;letter-spacing:.05em;text-transform:uppercase">Credit Details</p>
      <p style="margin:0 0 4px;font-size:14px;color:#374151"><strong>Tier:</strong> ${tierLabel}</p>
      <p style="margin:0 0 4px;font-size:14px;color:#374151"><strong>Credits included:</strong> ${creditLabel}</p>
      <p style="margin:0 0 4px;font-size:14px;color:#374151"><strong>Valid until:</strong> ${expDate}</p>
      <p style="margin:0;font-size:14px;color:#374151"><strong>Transferable:</strong> Yes — you may gift this credit to anyone</p>
    </div>
    <p style="margin:0 0 16px;color:#374151">When you are ready to schedule an inspection, visit <a href="${APP_URL}/book" style="color:#059669">${APP_URL}/book</a> and enter your credit code at checkout.</p>
    <p style="margin:0;font-size:13px;color:#9ca3af">Credits expire after 24 months from purchase and are not redeemable for cash.</p>
  `);

  return { subject: "Your RideCheck Founding Supporter Credit", html };
}

export function buildGiftRecipientEmail({
  senderName,
  recipientName,
  giftMessage,
  creditCode,
  tier,
  creditsCount,
  expiresAt,
}: {
  senderName: string;
  recipientName: string;
  giftMessage?: string | null;
  creditCode: string;
  tier: string;
  creditsCount: number;
  expiresAt: string;
}): { subject: string; html: string } {
  const tierLabel   = TIER_LABELS[tier]  ?? tier;
  const creditLabel = CREDIT_LABELS[tier] ?? `${creditsCount} RideCheck Credit${creditsCount > 1 ? "s" : ""}`;
  const expDate     = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const html = base(`
    <p style="margin:0 0 16px">Hi ${recipientName},</p>
    <p style="margin:0 0 16px"><strong>${senderName}</strong> sent you a RideCheck Credit — a pre-paid vehicle inspection that gives you a professional, independent assessment of any used car before you buy.</p>
    ${giftMessage ? `<div style="background:#f9fafb;border-left:4px solid #059669;padding:12px 16px;margin:0 0 24px;border-radius:0 8px 8px 0"><p style="margin:0;font-style:italic;color:#374151">"${giftMessage}"</p></div>` : ""}
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin:0 0 24px;text-align:center">
      <p style="margin:0 0 6px;font-size:12px;color:#059669;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Your RideCheck Credit Code</p>
      <p style="margin:0 0 6px;font-size:26px;font-weight:700;letter-spacing:.08em;color:#064e3b;font-family:monospace">${creditCode}</p>
      <p style="margin:0;font-size:13px;color:#374151">${tierLabel} &middot; ${creditLabel}</p>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;font-weight:700;letter-spacing:.05em;text-transform:uppercase">Credit Details</p>
      <p style="margin:0 0 4px;font-size:14px;color:#374151"><strong>Valid until:</strong> ${expDate}</p>
      <p style="margin:0;font-size:14px;color:#374151"><strong>Transferable:</strong> Yes</p>
    </div>
    <p style="margin:0 0 16px;color:#374151">To schedule your inspection, visit <a href="${APP_URL}/book" style="color:#059669">${APP_URL}/book</a> and enter the code above at checkout.</p>
    <p style="margin:0;font-size:13px;color:#9ca3af">Expires ${expDate} &middot; Not redeemable for cash.</p>
  `);

  return { subject: `${senderName} sent you a RideCheck Credit`, html };
}
