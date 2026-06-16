/**
 * lib/notifications/replyToAddress.ts
 *
 * Single source of truth for the reply-to address on all outbound RideCheck emails.
 *
 * The reply-to address encodes the order number so the inbound email webhook
 * can match the reply back to the correct order using the reply_to_tag strategy.
 *
 * Format:   RideCheck Ops <replies+RC-1027@replies.ridecheckauto.com>
 *
 * Environment variable:
 *   INBOUND_REPLY_DOMAIN — the subdomain that has an MX record pointing to the
 *                          inbound email provider (Postmark, etc.).
 *                          Default: replies.ridecheckauto.com
 *
 * NOTE: This must be the MX subdomain, NOT the main app domain.
 *       ridecheckauto.com has no inbound MX record.
 *       replies.ridecheckauto.com is the subdomain routed to Postmark.
 */

export function buildReplyTo(orderNumber: string | null | undefined): string | undefined {
  if (!orderNumber) return undefined;
  const domain = process.env.INBOUND_REPLY_DOMAIN || "replies.ridecheckauto.com";
  return `RideCheck Ops <replies+${orderNumber}@${domain}>`;
}
