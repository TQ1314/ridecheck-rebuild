/**
 * lib/seller-contact/sellerMessaging.ts
 *
 * Centralized, conversion-focused seller messaging module.
 * Every message embeds the RideCheck persuasion framework:
 *  1. Serious buyer — has already arranged / is ready to proceed
 *  2. Low friction  — 30–45 minutes
 *  3. Convenience   — we come to you / on your lot / at your location
 *  4. Non-invasive  — no repairs, no disassembly, no modifications
 *  5. Trust         — independent vehicle inspection service
 *  6. Benefit       — helps serious buyers move forward with confidence
 *  7. Clear CTA     — reply with a time that works
 *
 * Source-aware variants: marketplace (default) | dealership | roadside
 * Attempt sequence: 1 = Initial outreach | 2 = Follow-up | 3 = Final follow-up
 *
 * Used client-side (template preview) and server-side (send route → HTML generation).
 * Returns plain text only — HTML wrapping is done in sellerOutreachEmail.ts.
 */

const SIGN_OFF = `Thank you,\nRideCheck Operations\nsupport@ridecheckauto.com`;
const BRAND    = "RideCheck";

export interface SellerMessageParams {
  vehicleLabel:  string;
  listingSource?: string | null;
  preferredDate?: string | null;
  attemptNumber?: number;
}

export interface SellerMessageBundle {
  smsBody:      string;
  emailSubject: string;
  emailText:    string;
}

/** Human-readable label for each attempt number. */
export function getAttemptLabel(n: number): string {
  if (n === 2) return "Follow-up";
  if (n >= 3)  return "Final Follow-up";
  return "Initial Outreach";
}

/** Returns all three attempt bundles for a given context (for pickers). */
export function getAllAttempts(
  params: Omit<SellerMessageParams, "attemptNumber">
): SellerMessageBundle[] {
  return [1, 2, 3].map((n) => getSellerMessage({ ...params, attemptNumber: n }));
}

export function getSellerMessage(p: SellerMessageParams): SellerMessageBundle {
  const attempt = Math.max(1, Math.min(p.attemptNumber ?? 1, 3));
  const v       = p.vehicleLabel;
  const date    = p.preferredDate ? `on or around ${p.preferredDate}` : "this week";

  switch (p.listingSource) {
    case "dealership": return dealershipBundle(v, date, attempt);
    case "roadside":   return roadsideBundle(v, date, attempt);
    default:           return marketplaceBundle(v, date, attempt);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETPLACE / ONLINE LISTING (default)
// ─────────────────────────────────────────────────────────────────────────────

function marketplaceBundle(v: string, date: string, attempt: number): SellerMessageBundle {
  const subjects = [
    `Pre-purchase inspection request for your ${v} — ${BRAND}`,
    `Follow-up: Inspection request for your ${v} — ${BRAND}`,
    `Final follow-up: Inspection for your ${v} — ${BRAND}`,
  ];

  const sms = [
    `Hi, I'm reaching out from ${BRAND}. A serious buyer has already arranged a pre-purchase inspection for your ${v}. It takes 30–45 min, we come to you, and is completely non-invasive — no repairs or disassembly. Would you be available ${date}? Reply with a time that works. Thanks!`,
    `Hi — following up from ${BRAND} regarding your ${v}. The buyer is still ready to move forward and just needs the inspection scheduled. 30–45 min, we come to you. Available ${date}? Reply with a time. Thanks!`,
    `Final follow-up from ${BRAND} re: your ${v}. A serious buyer is waiting on the inspection to commit. Available for a 30–45 min check ${date}? If no reply, we'll note this as unreachable. Thanks.`,
  ];

  const emails = [
    [
      `Hello,`,
      ``,
      `I'm reaching out on behalf of ${BRAND}, an independent vehicle inspection service.`,
      ``,
      `A serious buyer has already arranged a professional pre-purchase inspection for your ${v}. The inspection gives buyers the confidence they need to move forward — and it is completely non-invasive and free for you as the seller.`,
      ``,
      `Here's what to expect:`,
      `• Duration: 30–45 minutes at your location (we come to you)`,
      `• No prep required — just access to the vehicle`,
      `• Non-invasive: no repairs, no disassembly, no modifications`,
      `• Our inspector handles all scheduling and logistics`,
      ``,
      `Would you be available ${date}? If that window doesn't work, let us know any availability and we'll accommodate.`,
      ``,
      `Please reply with a time and a good address or contact number.`,
      ``,
      SIGN_OFF,
    ].join(`\n`),

    [
      `Hello,`,
      ``,
      `I wanted to follow up on my earlier message about the ${v}.`,
      ``,
      `The buyer is still very interested and ready to move forward — the ${BRAND} inspection is the final step before they can commit. We understand schedules are busy and are happy to work around your availability.`,
      ``,
      `If ${date} no longer works, please let us know any window and we'll schedule around you. The inspection is just 30–45 minutes and we come to your location.`,
      ``,
      `Please reply at your earliest convenience.`,
      ``,
      SIGN_OFF,
    ].join(`\n`),

    [
      `Hello,`,
      ``,
      `This is our final follow-up regarding the ${v}.`,
      ``,
      `A serious buyer is ready to commit, but needs the ${BRAND} inspection confirmed before they can proceed. If you are still open to the inspection, please reply with any availability — even a brief window works.`,
      ``,
      `If we are unable to confirm availability, we will advise the buyer that the seller was unreachable, and they may need to consider other options.`,
      ``,
      `We hope to hear from you soon.`,
      ``,
      SIGN_OFF,
    ].join(`\n`),
  ];

  return {
    smsBody:      sms[attempt - 1],
    emailSubject: subjects[attempt - 1],
    emailText:    emails[attempt - 1],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEALERSHIP
// ─────────────────────────────────────────────────────────────────────────────

function dealershipBundle(v: string, date: string, attempt: number): SellerMessageBundle {
  const subjects = [
    `Pre-purchase inspection request — ${v} at your dealership — ${BRAND}`,
    `Follow-up: Inspection for ${v} at your dealership — ${BRAND}`,
    `Final follow-up: Inspection for ${v} at your dealership — ${BRAND}`,
  ];

  const sms = [
    `Hi, this is ${BRAND}. A buyer has arranged an independent pre-purchase inspection for a ${v} at your dealership. It's a 30–45 min non-invasive walkthrough on your lot during business hours — no prep needed. Available ${date}? Reply with a time and contact. Thanks!`,
    `Hi — following up from ${BRAND} re: the ${v} at your dealership. The buyer is ready to move forward and just needs the inspection scheduled. We work around your team's schedule — 30–45 min on-site. Available ${date}? Reply with a time. Thanks!`,
    `Final follow-up from ${BRAND} re: the ${v} at your dealership. Buyer is ready to commit pending the inspection. Available for a 30–45 min on-lot walkthrough ${date}? No reply = unreachable noted. Thanks.`,
  ];

  const emails = [
    [
      `Hello,`,
      ``,
      `I'm reaching out on behalf of ${BRAND}, an independent vehicle inspection service.`,
      ``,
      `A buyer is interested in the ${v} at your dealership and has arranged a professional pre-purchase inspection through us. We coordinate with dealerships regularly and work entirely around your team's schedule and business hours.`,
      ``,
      `What to expect:`,
      `• Duration: 30–45 minutes on your lot`,
      `• Our inspector works directly with your sales staff`,
      `• No preparation required — fully non-invasive`,
      `• Scheduled during your business hours at your convenience`,
      ``,
      `We'd like to arrange the walkthrough ${date}. Can your team accommodate? If not, please let us know your team's availability and we'll schedule around you.`,
      ``,
      `Please reply with a convenient time and the best person to coordinate with.`,
      ``,
      SIGN_OFF,
    ].join(`\n`),

    [
      `Hello,`,
      ``,
      `I wanted to follow up on my earlier message regarding the ${v} at your dealership.`,
      ``,
      `The buyer is still ready to move forward and just needs the inspection confirmed. We're happy to accommodate any time that works for your team — the inspection is 30–45 minutes and our inspector will coordinate directly with your floor staff.`,
      ``,
      `If the original window no longer works, please let us know your team's availability and we'll arrange around you.`,
      ``,
      `Please reply at your earliest convenience.`,
      ``,
      SIGN_OFF,
    ].join(`\n`),

    [
      `Hello,`,
      ``,
      `This is our final follow-up regarding the ${v} at your dealership.`,
      ``,
      `A buyer is ready to commit pending the ${BRAND} inspection. If your team can accommodate a 30–45 minute non-invasive walkthrough on your lot ${date}, please reply with a time and point of contact.`,
      ``,
      `If we are unable to confirm availability, we will need to advise the buyer accordingly.`,
      ``,
      `Thank you for your time,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join(`\n`),
  ];

  return {
    smsBody:      sms[attempt - 1],
    emailSubject: subjects[attempt - 1],
    emailText:    emails[attempt - 1],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROADSIDE / FOR SALE SIGN
// ─────────────────────────────────────────────────────────────────────────────

function roadsideBundle(v: string, date: string, attempt: number): SellerMessageBundle {
  const subjects = [
    `Pre-purchase inspection for your ${v} — ${BRAND}`,
    `Follow-up: Inspection for your ${v} — ${BRAND}`,
    `Final follow-up: Inspection for your ${v} — ${BRAND}`,
  ];

  const sms = [
    `Hi, I'm reaching out from ${BRAND} about the ${v} with the For Sale sign. A buyer has arranged an independent pre-purchase inspection. It's 30–45 min at your location — non-invasive, no repairs, no disassembly. We come to you. Available ${date}? Reply with a time. Thanks!`,
    `Hi — following up from ${BRAND} about the ${v} for sale. The buyer is still very interested. Just need to schedule a 30–45 min inspection at your location. Available ${date}? Reply with a time. Thanks!`,
    `Final follow-up from ${BRAND} re: the ${v} for sale. Buyer ready to proceed — just need to schedule a 30–45 min inspection ${date}. No reply = unreachable noted. Thanks.`,
  ];

  const emails = [
    [
      `Hello,`,
      ``,
      `I'm reaching out from ${BRAND}, an independent vehicle inspection service, regarding the ${v} you have for sale.`,
      ``,
      `A serious buyer has arranged a professional pre-purchase inspection through us and would like to schedule a visit. This is a standard process that gives buyers the confidence to move forward — and there's no obligation or cost to you.`,
      ``,
      `What to expect:`,
      `• Duration: 30–45 minutes at your location (we come to you)`,
      `• No prep required — just access to the vehicle`,
      `• Non-invasive: no repairs, no disassembly, no modifications`,
      `• Our inspector handles all scheduling and logistics`,
      ``,
      `Would you be available ${date}? Please reply with a time and location that works for you.`,
      ``,
      SIGN_OFF,
    ].join(`\n`),

    [
      `Hello,`,
      ``,
      `Following up on my earlier message about the ${v} you have for sale.`,
      ``,
      `The buyer is still very interested and ready to move forward — the ${BRAND} inspection is the last step before they can commit. We're flexible on timing and happy to accommodate your schedule.`,
      ``,
      `If ${date} doesn't work, any availability you have is fine — the inspection is just 30–45 minutes at your location.`,
      ``,
      `Please reply at your earliest convenience.`,
      ``,
      SIGN_OFF,
    ].join(`\n`),

    [
      `Hello,`,
      ``,
      `This is our final follow-up about the ${v} for sale.`,
      ``,
      `A serious buyer is ready to move forward but needs the inspection confirmed first. If you're available for a 30–45 minute non-invasive check ${date}, please reply with a time and your location.`,
      ``,
      `If we are unable to confirm availability, we will advise the buyer that the seller was unreachable.`,
      ``,
      `Thank you for your time,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join(`\n`),
  ];

  return {
    smsBody:      sms[attempt - 1],
    emailSubject: subjects[attempt - 1],
    emailText:    emails[attempt - 1],
  };
}
