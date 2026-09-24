import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const INTAKE_COOKIE = "ridecheck_intake";
const SESSION_TTL_SECONDS = 60 * 60 * 24;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("SESSION_SECRET is not configured");
  return value;
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

export function createIntakeSession(): string {
  const id = randomUUID();
  return `${id}.${sign(id)}`;
}

export function verifyIntakeSession(value: string | undefined): string | null {
  if (!value) return null;
  const [id, signature] = value.split(".");
  if (!id || !signature) return null;
  const expected = sign(id);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return id;
}

export function currentIntakeSession(): string | null {
  return verifyIntakeSession(cookies().get(INTAKE_COOKIE)?.value);
}

export function setIntakeCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }, value: string) {
  response.cookies.set(INTAKE_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}
