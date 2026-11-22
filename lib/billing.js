import Stripe from "stripe";
import { ObjectId } from "mongodb";

const TRIAL_MS = 30 * 24 * 60 * 60 * 1000;
const WARN_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_TRIAL_SECONDS = 48 * 60 * 60 + 120;

export function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return null;
  return new Stripe(key);
}

export function trialEndsAt(shop) {
  const start = shop?.createdAt ? new Date(shop.createdAt) : new Date();
  return new Date(start.getTime() + TRIAL_MS);
}

function dayLabel(ends) {
  return ends.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" });
}

export function billingSummary(shop) {
  const status = String(shop?.billing?.status || "");
  const paid = status === "active" || status === "trialing";
  const ends = trialEndsAt(shop);
  const msLeft = ends.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const configured = Boolean(stripeClient());
  const base = { paid, status, daysLeft, endsLabel: dayLabel(ends), configured, warn: false, message: "" };
  if (paid) return base;
  if (status === "past_due" || status === "unpaid") {
    return { ...base, warn: true, message: "The card needs attention. Tap to update it." };
  }
  if (msLeft > WARN_MS) return base;
  if (msLeft > 0) {
    const noun = daysLeft === 1 ? "day" : "days";
    return { ...base, warn: true, message: `Free month ends in ${daysLeft} ${noun}. Tap to add a card so replies keep going.` };
  }
  return { ...base, warn: true, message: "The free month is over. Tap to add a card and keep replies, nudges, and review links running." };
}

function priceLine() {
  const price = String(process.env.STRIPE_PRICE_ID || "").trim();
  if (price) return { price, quantity: 1 };
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: 1999,
      recurring: { interval: "month" },
      product_data: { name: "Traack" },
    },
  };
}

export async function createCheckout(shop, origin) {
  const stripe = stripeClient();
  if (!stripe) return { error: "Card payments are not connected yet." };
  const shopId = shop._id.toString();
  const trialEnd = Math.floor(trialEndsAt(shop).getTime() / 1000);
  const subscriptionData = { metadata: { shopId } };
  if (trialEnd > Math.floor(Date.now() / 1000) + MIN_TRIAL_SECONDS) subscriptionData.trial_end = trialEnd;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: shop.billing?.stripeCustomerId || undefined,
    customer_email: shop.billing?.stripeCustomerId ? undefined : shop.email,
    client_reference_id: shopId,
    metadata: { shopId },
    line_items: [priceLine()],
    subscription_data: subscriptionData,
    success_url: `${origin}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/settings?billing=cancel#billing`,
  });
  return { url: session.url };
}

export async function createPortal(shop, origin) {
  const stripe = stripeClient();
  const customer = shop.billing?.stripeCustomerId;
  if (!stripe || !customer) return { error: "Add a card first." };
  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${origin}/settings#billing`,
  });
  return { url: session.url };
}

export async function saveSubscription(db, shopId, subscription, customerId) {
  if (!shopId || !ObjectId.isValid(String(shopId))) return;
  const status = String(subscription?.status || "");
  await db.collection("shops").updateOne(
    { _id: new ObjectId(String(shopId)) },
    {
      $set: {
        "billing.stripeCustomerId": String(customerId || subscription?.customer || ""),
        "billing.stripeSubscriptionId": String(subscription?.id || ""),
        "billing.status": status,
        "billing.updatedAt": new Date(),
      },
    }
  );
}

export async function applyCheckoutSession(db, shop, sessionId) {
  const stripe = stripeClient();
  if (!stripe || !sessionId) return shop;
  const session = await stripe.checkout.sessions.retrieve(String(sessionId), { expand: ["subscription"] });
  if (session.client_reference_id !== shop._id.toString()) return shop;
  if (session.status !== "complete") return shop;
  const subscription = session.subscription && typeof session.subscription === "object" ? session.subscription : null;
  await saveSubscription(db, shop._id, subscription, session.customer);
  return db.collection("shops").findOne({ _id: shop._id });
}

export async function shopIdFromSubscription(db, subscription) {
  const fromMeta = subscription?.metadata?.shopId;
  if (fromMeta && ObjectId.isValid(fromMeta)) return fromMeta;
  const customer = String(subscription?.customer || "");
  if (!customer) return "";
  const shop = await db.collection("shops").findOne({ "billing.stripeCustomerId": customer }, { projection: { _id: 1 } });
  return shop ? shop._id.toString() : "";
}
