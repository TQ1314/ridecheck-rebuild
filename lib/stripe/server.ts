import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-05-28.basil" as any })
  : null;

export function getStripe() {
  if (!stripe) {
    console.warn("[Stripe] STRIPE_SECRET_KEY not set — Stripe disabled");
  }
  return stripe;
}
