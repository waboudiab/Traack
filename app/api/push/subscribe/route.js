import { json } from "@/lib/http";
import { vapidPublicKey } from "@/lib/push";
import { currentShop } from "@/lib/session";

export async function GET() {
  const publicKey = vapidPublicKey();
  const read = new Function("name", "return process.env[name]");
  const privateKey = String(read("VAPID_PRIVATE_KEY") || "").trim();
  return json({ public: Boolean(publicKey), private: Boolean(privateKey) });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const ctx = await currentShop().catch((error) => ({ error }));
  if (ctx?.error) return json({ error: ctx.error.message }, 500);
  if (!ctx?.shop) return json({ error: "Sign in required." }, 401);

  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "");
  const p256dh = String(body.keys?.p256dh || "");
  const auth = String(body.keys?.auth || "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return json({ error: "Notification setup was incomplete." }, 400);
  }

  const subscription = { endpoint, keys: { p256dh, auth }, createdAt: new Date() };
  await ctx.db.collection("shops").updateOne(
    { _id: ctx.shop._id },
    { $pull: { pushSubscriptions: { endpoint } } }
  );
  await ctx.db.collection("shops").updateOne(
    { _id: ctx.shop._id },
    { $push: { pushSubscriptions: subscription } }
  );
  return json({ ok: true });
}

export async function DELETE(req) {
  const ctx = await currentShop().catch((error) => ({ error }));
  if (ctx?.error) return json({ error: ctx.error.message }, 500);
  if (!ctx?.shop) return json({ error: "Sign in required." }, 401);
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "");
  if (endpoint) {
    await ctx.db.collection("shops").updateOne(
      { _id: ctx.shop._id },
      { $pull: { pushSubscriptions: { endpoint } } }
    );
  }
  return json({ ok: true });
}
