import webpush from "web-push";

function envValue(name) {
  const read = new Function("name", "return process.env[name]");
  return String(read(name) || "").trim().replace(/^["']|["']$/g, "");
}

export function vapidPublicKey() {
  return envValue("VAPID_PUBLIC_KEY");
}

function ready() {
  return Boolean(envValue("VAPID_PUBLIC_KEY") && envValue("VAPID_PRIVATE_KEY"));
}

function setup() {
  webpush.setVapidDetails(
    "mailto:waliddiab08@gmail.com",
    envValue("VAPID_PUBLIC_KEY"),
    envValue("VAPID_PRIVATE_KEY")
  );
}

export async function sendShopPush(db, shopId, payload) {
  if (!ready()) return;
  setup();
  const shop = await db.collection("shops").findOne({ _id: shopId }, { projection: { pushSubscriptions: 1 } });
  const subscriptions = shop?.pushSubscriptions || [];
  if (!subscriptions.length) return;
  const dead = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        );
      } catch (error) {
        const status = error?.statusCode;
        if (status === 404 || status === 410) dead.push(sub.endpoint);
        else console.error("push", status || error?.message);
      }
    })
  );
  if (dead.length) {
    await db.collection("shops").updateOne(
      { _id: shopId },
      { $pull: { pushSubscriptions: { endpoint: { $in: dead } } } }
    );
  }
}
