import { sendNotification, setVapidDetails } from "web-push";

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
  setVapidDetails(
    "mailto:waliddiab08@gmail.com",
    envValue("VAPID_PUBLIC_KEY"),
    envValue("VAPID_PRIVATE_KEY")
  );
}

export async function sendShopPush(db, shopId, payload) {
  if (!ready()) return { sent: 0 };
  try {
    setup();
    const shop = await db.collection("shops").findOne({ _id: shopId }, { projection: { pushSubscriptions: 1 } });
    const subscriptions = shop?.pushSubscriptions || [];
    if (!subscriptions.length) return { sent: 0 };
    const dead = [];
    let sent = 0;
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            JSON.stringify(payload)
          );
          sent += 1;
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
    return { sent };
  } catch (error) {
    console.error("push", error?.message || error);
    return { sent: 0 };
  }
}
