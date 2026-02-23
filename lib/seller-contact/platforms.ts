export type SellerPlatform = 'facebook' | 'craigslist' | 'dealer' | 'other';

export type ContactChannel =
  | 'fb_message'
  | 'call'
  | 'sms'
  | 'email'
  | 'buyer_message';

const ALLOWED_CHANNELS: Record<SellerPlatform, ContactChannel[]> = {
  facebook: ['fb_message', 'call', 'sms', 'email'],
  craigslist: ['email', 'sms', 'call'],
  dealer: ['call', 'email', 'sms'],
  other: ['call', 'email', 'sms'],
};

export function detectSellerPlatform(listingUrl?: string | null): SellerPlatform {
  if (!listingUrl) return 'other';
  try {
    const hostname = new URL(listingUrl).hostname.toLowerCase();
    if (
      hostname.includes('facebook.com') ||
      hostname.includes('fb.com') ||
      hostname.includes('marketplace')
    ) {
      return 'facebook';
    }
    if (hostname.includes('craigslist.org')) {
      return 'craigslist';
    }
    if (
      hostname.includes('cargurus.com') ||
      hostname.includes('autotrader.com') ||
      hostname.includes('cars.com') ||
      hostname.includes('carfax.com') ||
      hostname.includes('truecar.com')
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
