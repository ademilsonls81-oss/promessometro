import { Request, Response } from "express";

/**
 * Stripe Webhook handler (stub).
 * Replace with real Stripe logic when STRIPE_WEBHOOK_SECRET is configured.
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret) {
    console.warn("[Stripe] STRIPE_WEBHOOK_SECRET not set — webhook ignored");
    res.status(200).json({ received: true, note: "Stripe not configured" });
    return;
  }

  try {
    const rawBody = req.body as Buffer;
    // Stripe SDK requires signature as string, not string[]
    const signature = Array.isArray(req.headers["stripe-signature"])
      ? req.headers["stripe-signature"][0]
      : req.headers["stripe-signature"];

    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    // Lazy-import stripe only if the key is available
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2026-03-25.dahlia" as any,
    });

    const event = stripe.webhooks.constructEvent(rawBody, signature, stripeSecret);

    console.log(`[Stripe] Event received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed":
        // TODO: update subscription in DB
        break;
      case "customer.subscription.deleted":
        // TODO: revoke pro access in DB
        break;
      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {  // any-ok
    console.error("[Stripe] Webhook error:", err.message);
    res.status(400).json({ error: err.message });
  }
}
