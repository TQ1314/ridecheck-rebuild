import type { SellerPlatform, ContactChannel } from './platforms';

export interface SellerTemplates {
  fb_message?: string;
  email?: string;
  sms?: string;
  call_script?: string;
  buyer_message?: string;
}

/** Returns a source-aware subject line for seller emails. */
export function getSellerEmailSubject(
  listingSource?: string | null,
  vehicleLabel?: string,
): string {
  const v = vehicleLabel || 'the vehicle';
  switch (listingSource) {
    case 'dealership':
      return `Vehicle Inspection Request — ${v} — RideCheck`;
    case 'roadside':
      return `Pre-Purchase Inspection — Your ${v} — RideCheck`;
    default:
      return `Re: ${v} — Pre-Purchase Inspection (RideCheck)`;
  }
}

// Returns 3 distinct message variants per channel based on attempt number (1, 2, or 3).
// Optional listingSource overrides SMS/email body for dealership and roadside contexts.
export function getSellerTemplates(
  platform: SellerPlatform,
  vehicleLabel: string,
  preferredDate?: string | null,
  attemptNumber: number = 1,
  listingSource?: string | null,
): SellerTemplates {
  const dateWindow = preferredDate
    ? `on or around ${preferredDate}`
    : 'sometime this week';

  const attempt = Math.max(1, Math.min(attemptNumber, 3));

  // ── Facebook / Direct Message ──────────────────────────────────────────────
  const fbMessages: Record<number, string> = {
    1: [
      `Hi! I'm interested in the ${vehicleLabel}.`,
      `A buyer has booked a professional pre-purchase inspection through RideCheck.`,
      `Could you accommodate a 30–45 minute inspection ${dateWindow}?`,
      `We come to you — no prep needed on your end.`,
      `Thanks!`,
    ].join(' '),
    2: [
      `Hi again — following up on my earlier message about the ${vehicleLabel}.`,
      `We still have a buyer ready to move forward, but we need to schedule the RideCheck inspection first.`,
      `Would you be available ${dateWindow}? It's a quick, non-invasive check.`,
      `Let us know what works!`,
    ].join(' '),
    3: [
      `Last check-in regarding the ${vehicleLabel}.`,
      `A buyer is still interested but needs the RideCheck inspection confirmed before committing.`,
      `If you're open to a 30–45 minute inspection ${dateWindow}, please let us know.`,
      `If we don't hear back we'll have to note this as no response. Thank you!`,
    ].join(' '),
  };

  // ── SMS ────────────────────────────────────────────────────────────────────
  // Base (online marketplace / default)
  const smsBodies: Record<number, string> = {
    1: `Hi, this is RideCheck. A buyer booked a pre-purchase inspection for your ${vehicleLabel}. Can we schedule 30–45 min ${dateWindow}? We come to you. Reply to confirm or call us. Thanks!`,
    2: `Hi — following up from RideCheck re: your ${vehicleLabel}. The buyer is still interested. Can you do a 30–45 min inspection ${dateWindow}? Reply with a time that works. Thanks!`,
    3: `Final follow-up from RideCheck re: your ${vehicleLabel}. We have a ready buyer awaiting inspection confirmation. Can you do ${dateWindow}? If no reply, we'll mark this as no response. Thanks.`,
  };

  if (listingSource === 'dealership') {
    smsBodies[1] = `Hi, this is RideCheck. A buyer booked a pre-purchase inspection for a ${vehicleLabel} at your dealership. Can we schedule a 30–45 min lot inspection ${dateWindow}? Reply or call us. Thanks!`;
    smsBodies[2] = `Following up from RideCheck re: ${vehicleLabel} at your dealership. Buyer still ready to proceed. Can we arrange 30–45 min on your lot ${dateWindow}? Reply with your availability. Thanks!`;
    smsBodies[3] = `Final follow-up from RideCheck re: ${vehicleLabel} at your dealership. Ready buyer awaiting inspection confirmation. Available ${dateWindow}? No reply = no response noted. Thanks.`;
  } else if (listingSource === 'roadside') {
    smsBodies[1] = `Hi, I got your number about the ${vehicleLabel}. This is RideCheck — a buyer booked a pre-purchase inspection. Can we schedule 30–45 min ${dateWindow}? We come to you. Reply to confirm. Thanks!`;
    smsBodies[2] = `Hi again — following up from RideCheck about your ${vehicleLabel}. Buyer is still interested. Available ${dateWindow} for a quick 30–45 min check? Reply with a time. Thanks!`;
    smsBodies[3] = `Last check-in from RideCheck re: your ${vehicleLabel}. Buyer ready to proceed if we can confirm an inspection ${dateWindow}. No reply = no response noted. Thanks.`;
  }

  // ── Email ──────────────────────────────────────────────────────────────────
  // Base (online marketplace / default)
  const emailBodies: Record<number, string> = {
    1: [
      `Hello,`,
      ``,
      `I'm reaching out regarding your listing for the ${vehicleLabel}.`,
      `A buyer has arranged a professional pre-purchase inspection through RideCheck, an independent vehicle inspection service.`,
      ``,
      `We'd like to schedule a brief 30–45 minute inspection ${dateWindow} at a location convenient for you.`,
      `The inspection is non-invasive and does not require any preparation on your part.`,
      ``,
      `Would you be available? Please reply with a time and location that works for you.`,
      ``,
      `Thank you,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join('\n'),
    2: [
      `Hello,`,
      ``,
      `I wanted to follow up on my previous message about the ${vehicleLabel}.`,
      `We still have a buyer who is very interested in moving forward, but we need to get the RideCheck inspection scheduled.`,
      ``,
      `If ${dateWindow} no longer works, please let us know any availability you have and we will accommodate.`,
      `The inspection takes 30–45 minutes and the buyer or our inspector will come to your location.`,
      ``,
      `Please reply at your earliest convenience.`,
      ``,
      `Thank you,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join('\n'),
    3: [
      `Hello,`,
      ``,
      `This is our final follow-up regarding the ${vehicleLabel}.`,
      `We have a buyer ready to proceed, but need the inspection confirmed before they can commit.`,
      ``,
      `If you are still interested in working with us, please reply with your availability for a 30–45 minute inspection ${dateWindow}.`,
      `If we do not hear back, we will note this listing as unresponsive and advise the buyer accordingly.`,
      ``,
      `Thank you for your time,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join('\n'),
  };

  if (listingSource === 'dealership') {
    emailBodies[1] = [
      `Hello,`,
      ``,
      `I'm reaching out regarding the ${vehicleLabel} at your dealership.`,
      `A buyer has arranged a professional pre-purchase inspection through RideCheck, an independent vehicle inspection service.`,
      ``,
      `We'd like to schedule a brief 30–45 minute inspection walkthrough on your lot ${dateWindow}, at a time convenient for your team.`,
      `Our inspector works directly with your sales staff — no preparation needed. The inspection is fully non-invasive.`,
      ``,
      `Would your team be available? Please reply with a time and the best contact person to coordinate with.`,
      ``,
      `Thank you,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join('\n');
    emailBodies[2] = [
      `Hello,`,
      ``,
      `I wanted to follow up on my previous message about the ${vehicleLabel} at your dealership.`,
      `We still have a buyer ready to move forward, but need to schedule the RideCheck inspection first.`,
      ``,
      `If the original time window no longer works, please let us know your team's availability and we'll accommodate.`,
      `The inspection takes 30–45 minutes and our inspector works around your schedule.`,
      ``,
      `Please reply at your earliest convenience.`,
      ``,
      `Thank you,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join('\n');
    emailBodies[3] = [
      `Hello,`,
      ``,
      `This is our final follow-up regarding the ${vehicleLabel} at your dealership.`,
      `A buyer is ready to proceed pending the inspection. If your team is available for a 30–45 minute walkthrough ${dateWindow}, please reply with a time.`,
      ``,
      `If we do not hear back, we will note this as unresponsive and advise the buyer accordingly.`,
      ``,
      `Thank you,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join('\n');
  } else if (listingSource === 'roadside') {
    emailBodies[1] = [
      `Hello,`,
      ``,
      `I'm reaching out about the ${vehicleLabel} you have for sale.`,
      `A buyer has arranged a professional pre-purchase inspection through RideCheck, an independent vehicle inspection service.`,
      ``,
      `We'd like to schedule a brief 30–45 minute inspection ${dateWindow} at a location that's convenient for you. We come to you — no preparation needed.`,
      ``,
      `Would you be available? Please reply with a time and address that works.`,
      ``,
      `Thank you,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join('\n');
    emailBodies[2] = [
      `Hello,`,
      ``,
      `Following up on my previous message about the ${vehicleLabel}.`,
      `We still have a buyer who is very interested in moving forward, and the RideCheck inspection is the last step before they commit.`,
      ``,
      `If ${dateWindow} no longer works, please let us know any availability and we'll accommodate.`,
      `The inspection takes 30–45 minutes at your location.`,
      ``,
      `Please reply at your earliest convenience.`,
      ``,
      `Thank you,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join('\n');
    emailBodies[3] = [
      `Hello,`,
      ``,
      `This is our final follow-up regarding the ${vehicleLabel}.`,
      `We have a buyer ready to proceed, but need the inspection scheduled to confirm.`,
      ``,
      `If you're available for a 30–45 minute inspection ${dateWindow}, please reply with a time.`,
      `If we do not hear back, we will note this as no response.`,
      ``,
      `Thank you for your time,`,
      `RideCheck Operations`,
      `support@ridecheckauto.com`,
    ].join('\n');
  }

  // ── Call Script ────────────────────────────────────────────────────────────
  const callScripts: Record<number, string> = {
    1: [
      `- Introduce yourself: "Hi, I'm calling from RideCheck, a vehicle inspection service."`,
      `- Explain purpose: "A buyer has booked a pre-purchase inspection for your ${vehicleLabel}."`,
      `- Ask availability: "Would you be available ${dateWindow} for a 30–45 minute inspection?"`,
      `- Clarify logistics: "We send a certified inspector to your location. No prep needed."`,
      `- Confirm details: "Can I get a good address and time that works for you?"`,
      `- If hesitant: "It's standard practice and helps the buyer move forward with confidence."`,
      `- Close: "Thank you! We'll send a confirmation with the inspector's details."`,
    ].join('\n'),
    2: [
      `- Introduce yourself: "Hi, I'm calling from RideCheck — I may have reached out before about your ${vehicleLabel}."`,
      `- Explain: "We still have an interested buyer, but they need the inspection scheduled to proceed."`,
      `- Ask: "Has your availability changed? We're flexible on timing — ${dateWindow} ideally."`,
      `- Handle objection: "It only takes 30–45 minutes and our inspector comes to you."`,
      `- Close: "If this time doesn't work, what would be a better window for you?"`,
    ].join('\n'),
    3: [
      `- Introduce yourself: "Hi, final call from RideCheck regarding your ${vehicleLabel}."`,
      `- Explain urgency: "The buyer's window for purchase is closing and we need to confirm the inspection."`,
      `- Ask: "Is there any availability ${dateWindow} for a 30–45 min non-invasive check?"`,
      `- If no: "I understand — I'll note this as unable to schedule and update the buyer."`,
      `- If yes: "Excellent — let me confirm your address and we'll have an inspector out."`,
    ].join('\n'),
  };

  // ── Buyer Message (to forward to seller directly) ─────────────────────────
  const buyerMessages: Record<number, string> = {
    1: [
      `Hi! I'm interested in your ${vehicleLabel} and I'd like to have a quick pre-purchase inspection done before moving forward.`,
      `I've booked an inspector through RideCheck — they just need about 30–45 minutes at a spot that's convenient for you.`,
      `Would you be available ${dateWindow}?`,
      `It's completely non-invasive and no prep is needed on your end. Let me know what works!`,
    ].join(' '),
    2: [
      `Hi, following up on my earlier message about the ${vehicleLabel}!`,
      `I'm still very interested and my inspector through RideCheck is standing by.`,
      `Would ${dateWindow} work for a quick 30–45 minute inspection? I'm flexible on location.`,
      `Please let me know — I'd love to move forward!`,
    ].join(' '),
    3: [
      `Hi — this is my last check-in about the ${vehicleLabel}.`,
      `I'm still interested and my RideCheck inspector is ready to go.`,
      `If ${dateWindow} works for a 30–45 minute visit, just say the word.`,
      `Otherwise I'll have to look at other options. Thanks for your time!`,
    ].join(' '),
  };

  return {
    fb_message:    fbMessages[attempt],
    email:         emailBodies[attempt],
    sms:           smsBodies[attempt],
    call_script:   callScripts[attempt],
    buyer_message: buyerMessages[attempt],
  };
}

export function getTemplateForChannel(
  channel: ContactChannel,
  platform: SellerPlatform,
  vehicleLabel: string,
  preferredDate?: string | null,
  attemptNumber: number = 1,
  listingSource?: string | null,
): string {
  const templates = getSellerTemplates(platform, vehicleLabel, preferredDate, attemptNumber, listingSource);

  switch (channel) {
    case 'fb_message':
      return templates.fb_message ?? templates.sms ?? '';
    case 'email':
      return templates.email ?? '';
    case 'sms':
      return templates.sms ?? '';
    case 'call':
      return templates.call_script ?? '';
    case 'buyer_message':
      return templates.buyer_message ?? '';
    default:
      return '';
  }
}
