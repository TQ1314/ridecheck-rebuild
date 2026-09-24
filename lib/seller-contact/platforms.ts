export type SellerPlatform = 'facebook' | 'craigslist' | 'offerup' | 'dealer' | 'other';

export type ContactChannel =
  | 'fb_message'
  | 'call'
  | 'sms'
  | 'email'
  | 'buyer_message';

const ALLOWED_CHANNELS: Record<SellerPlatform, ContactChannel[]> = {
  facebook: ['fb_message', 'call', 'sms', 'email'],
  craigslist: ['email', 'sms', 'call'],
  offerup: ['buyer_message', 'call', 'sms', 'email'],
  dealer: ['call', 'email', 'sms'],
  other: ['call', 'email', 'sms'],
};

export function detectSellerPlatform(listingUrl?: string | null): SellerPlatform {
  if (!listingUrl) return 'other';
  try {
    const hostname = new URL(listingUrl).hostname.toLowerCase();
    const matches = (domain: string) => hostname === domain || hostname.endsWith(`.${domain}`);
    if (
      matches('facebook.com') ||
      matches('fb.com')
    ) {
      return 'facebook';
    }
    if (matches('craigslist.org')) {
      return 'craigslist';
    }
    if (matches('offerup.com')) return 'offerup';
    if (
      matches('cargurus.com') ||
      matches('autotrader.com') ||
      matches('cars.com') ||
      matches('carfax.com') ||
      matches('truecar.com')
    ) {
      return 'dealer';
    }
    return 'other';
  } catch {
    return 'other';
  }
}

export function getAllowedChannels(platform: SellerPlatform): ContactChannel[] {
  return ALLOWED_CHANNELS[platform] ?? ALLOWED_CHANNELS.other;
}

export function getChannelLabel(channel: ContactChannel): string {
  const labels: Record<ContactChannel, string> = {
    fb_message: 'Facebook Message',
    call: 'Phone Call',
    sms: 'SMS',
    email: 'Email',
    buyer_message: 'Buyer Message',
  };
  return labels[channel] ?? channel;
}
