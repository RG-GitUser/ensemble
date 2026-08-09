import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { billingEnabled, cancelSubscription, constructWebhookEvent, handleStripeEvent } from "@/lib/billing";

export async function POST(req: Request): Promise<NextResponse> {
  if (!billingEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch {
    // Opaque on purpose — this response lands in Stripe's webhook logs.
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const action = handleStripeEvent(event);
    if (action.cancelSubscriptionId) {
      // Best effort — reconcileBilling cleans up if this fails.
      try {
        await cancelSubscription(action.cancelSubscriptionId);
      } catch (err) {
        console.error(`Failed to cancel superseded subscription ${action.cancelSubscriptionId}:`, err);
      }
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`Stripe webhook handler failed for ${event.type}:`, err);
    // 500 so Stripe retries what may be a transient failure.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
