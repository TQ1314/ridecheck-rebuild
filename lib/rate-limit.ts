import "server-only";

interface Bucket {
  timestamps: number[];
}

const store = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_CLASSIFY = 20;

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
    if (bucket.timestamps.length === 0) store.delete(key);
  }
}, 30_000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(key: string, max = MAX_CLASSIFY): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);

  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((WINDOW_MS - (now - oldest)) / 1000),
    };
  }

  bucket.timestamps.push(now);
  store.set(key, bucket);

  return { allowed: true, remaining: max - bucket.timestamps.length, retryAfterSec: 0 };
}

export function getClientKey(req: Request): string {
  const xff = (req.headers as any).get?.("x-forwarded-for") ?? "";
  const realIp = (req.headers as any).get?.("x-real-ip") ?? "";
  const ip = (xff ? xff.split(",")[0].trim() : realIp) || "unknown";
  return `ip:${ip}`;
}
