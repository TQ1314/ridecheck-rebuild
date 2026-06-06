import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { TIER_CONFIG } from "@/lib/founding/credit-code";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  tier:                  z.enum(["backer", "believer", "founding_partner"]),
  name:                  z.string().min(2).max(200),
  email:                 z.string().email(),
  phone:                 z.string().max(30).nullable().optional(),
  gift_recipient_name:   z.string().max(200).nullable().optional(),
  gift_recipient_email:  z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  gift_message:          z.string().max(500).nullable().optional(),
  list_on_partners_page: z.boolean().optional(),
  terms_accepted:        z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (!data.terms_accepted) {
      return NextResponse.json(
        { error: "You must accept the terms to continue." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please contact support." },
        { status: 503 }
      );
    }

    const tier   = TIER_CONFIG[data.tier];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

    const metadata: Record<string, string> = {
      session_type:          "founding_supporter",
      tier:                  data.tier,
      supporter_name:        data.name,
      supporter_email:       data.email,
      supporter_phone:       data.phone                ?? "",
      gift_recipient_name:   data.gift_recipient_name  ?? "",
      gift_recipient_email:  data.gift_recipient_email ?? "",
      gift_message:          data.gift_message         ?? "",
      list_on_partners_page: data.list_on_partners_page ? "true" : "false",
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode:                 "payment",
      customer_email:       data.email,
      line_items: [
        {
          price_data: {
            currency:     "usd",
            product_data: {
              name:        `RideCheck — ${tier.label}`,
              description: `${tier.creditsCount} Standard RideCheck Credit${tier.creditsCount > 1 ? "s" : ""} · Valid 24 months · Transferable`,
            },
            unit_amount: tier.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${appUrl}/founding-supporters/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/founding-supporters`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("[founding/create-session]", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
