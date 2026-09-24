const HOSTNAME = /^[a-z0-9.-]+$/i;

export function isPrivateIntakeIp(host: string): boolean {
  const net = require("net") as typeof import("net");
  const version = net.isIP(host);
  if (version === 4) {
    const parts = host.split(".").map(Number);
    return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) ||
      (parts[0] === 198 && parts[1] === 51) || parts[0] >= 224;
  }
  if (version !== 6) return false;
  const raw = host.replace(/^\[|\]$/g, "").toLowerCase();
  const halves = raw.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  let right = halves[1] ? halves[1].split(":") : [];
  if (right.length && right[right.length - 1].includes(".")) {
    const parts = right.pop()!.split(".").map(Number);
    right.push(((parts[0] << 8) | parts[1]).toString(16), ((parts[2] << 8) | parts[3]).toString(16));
  }
  const words = (halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left)
    .map((part) => parseInt(part || "0", 16));
  if (words.length !== 8 || words.some((part) => !Number.isInteger(part) || part < 0 || part > 0xffff)) return true;
  if (words.slice(0, 5).every((part) => part === 0) && words[5] === 0xffff) {
    return isPrivateIntakeIp(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
  }
  const first = words[0];
  return words.every((part) => part === 0) ||
    (words.every((part, index) => index === 7 ? part === 1 : part === 0)) ||
    (first >= 0xfc00 && first <= 0xfdff) || (first >= 0xfe80 && first <= 0xfebf) ||
    (first >= 0xff00 && first <= 0xffff) || (first >= 0xfec0 && first <= 0xfeff) ||
    (words[0] === 0x2001 && words[1] === 0x0db8);
}

export function isSafeIntakeUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      (!HOSTNAME.test(host) && require("net").isIP(host) !== 6) || host === "localhost" || host.endsWith(".local") ||
      isPrivateIntakeIp(host)) return null;
    return url;
  } catch { return null; }
}

export function intakeImageIdsRequireSession(imageIds: unknown[]): boolean {
  return imageIds.length > 0;
}

export function isSessionImagePath(sessionId: string, imageId: string, path: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(sessionId) && /^[0-9a-f-]{36}$/i.test(imageId) &&
    path.startsWith(`${sessionId}/${imageId}.`) && !path.includes("..");
}
