import { twiml } from "@/lib/http";
import { getDb } from "@/lib/mongo";
import { sendMissedText, twilioSignatureOk } from "@/lib/outbound";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  if (!twilioSignatureOk(req, params)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const dial = params.DialCallStatus || "";
  if (dial === "completed" || dial === "answered") return twiml();

  const db = await getDb();
  const to = normalizePhone(params.To);
  const shop = to ? await db.collection("shops").findOne({ "phone.twilioNumber": to }) : null;
  if (!shop || !params.CallSid) return twiml();

  const message = await db.collection("messages").findOne({
    shopId: shop._id,
    externalId: `call:${params.CallSid}`,
  });
  if (!message || message.missSmsSent) return twiml();

  const lead = await db.collection("leads").findOne({ _id: message.leadId, shopId: shop._id });
  if (lead?.customerPhone) {
    const sent = await sendMissedText(db, shop, lead);
    if (sent.ok) {
      await db.collection("messages").updateOne({ _id: message._id }, { $set: { missSmsSent: true } });
    }
  }
  return twiml();
}
