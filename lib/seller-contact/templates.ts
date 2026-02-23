import type { SellerPlatform, ContactChannel } from './platforms';

export interface SellerTemplates {
  fb_message?: string;
  email?: string;
  sms?: string;
  call_script?: string;
  buyer_message?: string;
}

export function getSellerTemplates(
  platform: SellerPlatform,
  vehicleLabel: string,
  preferredDate?: string | null,
): SellerTemplates {
  const dateWindow = preferredDate
    ? `on or around ${preferredDate}`
    : 'sometime this week';

  const fbMessage = [
    `Hi! I'm interested in the ${vehicleLabel}.`,
    `A buyer has booked a pre-purchase inspection through RideCheck.`,
    `Would you be available ${dateWindow}?`,
    `We just need 30-45 min at a convenient location.`,
    `Thanks!`,
  ].join(' ');

  const emailBody = [
    `Hello,`,
    ``,
    `I'm reaching out regarding your listing for the ${vehicleLabel}.`,
    `A buyer has arranged a professional pre-purchase inspection through RideCheck, an independent vehicle inspection service.`,
    ``,
    `We'd like to schedule a brief 30-45 minute inspection ${dateWindow} at a location convenient for you.`,
    `The inspection is non-invasive and does not require any preparation on your part.`,
    ``,
    `Would you be available? Please let us know a time and location that works for you.`,
    ``,
    `Thank you,`,
    `RideCheck Operations`,
  ].join('\n');

  const smsBody = [
    `Hi, this is RideCheck. A buyer booked a pre-purchase inspection for your ${vehicleLabel}.`,
    `Can we schedule 30-45 min ${dateWindow}?`,
    `We come to you. Reply or call us to confirm. Thanks!`,
  ].join(' ');

  const callScript = [
    `- Introduce yourself: "Hi, I'm calling from RideCheck, a vehicle inspection service."`,
    `- Explain purpose: "A buyer has booked a pre-purchase inspection for your ${vehicleLabel}."`,
    `- Ask availability: "Would you be available ${dateWindow} for a 30-45 minute inspection?"`,
    `- Clarify logistics: "We send a certified inspector to your location. No prep needed."`,
    `- Confirm details: "Can I get a good address and time that works for you?"`,
    `- If hesitant: "It's standard practice and helps the buyer move forward with confidence."`,
    `- Close: "Thank you! We'll send a confirmation with the inspector's details."`,
  ].join('\n');

  const buyerMessage = [
    `Hi! I'm interested in your ${vehicleLabel} and I'd like to have a quick pre-purchase inspection done before moving forward.`,
    `I've booked an inspector through RideCheck - they just need about 30-45 minutes at a spot that's convenient for you.`,
    `Would you be available ${dateWindow}?`,
    `It's totally non-invasive and no prep is needed on your end.`,
    `Let me know what works!`,
  ].join(' ');

  return {
    fb_message: fbMessage,
    email: emailBody,
    sms: smsBody,
    call_script: callScript,
    buyer_message: buyerMessage,
  };
}

export function getTemplateForChannel(
  channel: ContactChannel,
  platform: SellerPlatform,
  vehicleLabel: string,
  preferredDate?: string | null,
): string {
  const templates = getSellerTemplates(platform, vehicleLabel, preferredDate);

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
