import { getDb } from "@/lib/mongo";
import { json } from "@/lib/http";
import { saveSubscription, shopIdFromSubscription, stripeClient } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const stripe = stripeClient();
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!stripe || !secret) return json({ error: "Stripe webhook is not configured." }, 400);
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, req.headers.get("stripe-signature") || "", secret);
  } catch (error) {
    return json({ error: error.message || "Invalid signature." }, 400);
  }

  try {
    const db = await getDb();
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const subscription = session.subscription
        ? await stripe.subscriptions.retrieve(String(session.subscription))
        : null;
      await saveSubscription(db, session.client_reference_id || session.metadata?.shopId, subscription, session.customer);
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const shopId = await shopIdFromSubscription(db, subscription);
      await saveSubscription(db, shopId, subscription, subscription.customer);
    }
  } catch (error) {
    console.error("stripe webhook", error);
    return json({ error: "Could not record the card." }, 500);
  }
  return json({ ok: true });
}
