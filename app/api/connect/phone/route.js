import { json } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { currentShop } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const ctx = await currentShop().catch((error) => ({ error }));
  if (ctx?.error) return json({ error: ctx.error.message }, 500);
  if (!ctx?.shop) return json({ error: "Sign in required." }, 401);

  const number = normalizePhone(process.env.TWILIO_PHONE_NUMBER);
  if (!number || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return json({ error: "Twilio is not configured yet. Add the account SID, token, and phone number." }, 400);
  }

  const body = await req.json().catch(() => ({}));
  const ownerMobile = normalizePhone(body.ownerMobile);
  if (!ownerMobile) return json({ error: "Enter the owner mobile that calls should reach." }, 400);
  const callMode = ["forward", "miss_sms", "both"].includes(body.callMode) ? body.callMode : "both";

  const other = await ctx.db.collection("shops").findOne({
    "phone.twilioNumber": number,
    _id: { $ne: ctx.shop._id },
  });
  if (other) return json({ error: "This Twilio number is already connected to another shop." }, 409);

  await ctx.db.collection("shops").updateOne(
    { _id: ctx.shop._id },
    {
      $set: {
        phone: {
          twilioNumber: number,
          ownerMobile,
          callMode,
          connectedAt: new Date(),
        },
        "settings.ownerMobile": ownerMobile,
      },
    }
  );
  return json({ ok: true, twilioNumber: number });
}
