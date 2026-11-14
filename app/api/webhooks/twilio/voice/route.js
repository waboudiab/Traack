import { publicOrigin, twiml } from "@/lib/http";
import { ingestInbound } from "@/lib/ingest";
import { getDb } from "@/lib/mongo";
import { sendMissedText, twilioSignatureOk } from "@/lib/outbound";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const say = '<Say voice="alice">Sorry we missed you. We will text you shortly.</Say>';

export async function POST(req) {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  if (!twilioSignatureOk(req, params)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const db = await getDb();
  const to = normalizePhone(params.To);
  const shop = to ? await db.collection("shops").findOne({ "phone.twilioNumber": to }) : null;
  if (!shop) return twiml("<Hangup/>");

  const from = normalizePhone(params.From);
  const mode = shop.phone?.callMode || "both";
  const owner = normalizePhone(shop.phone?.ownerMobile || shop.settings?.ownerMobile);
  const result = await ingestInbound(db, shop, {
    channel: "call",
    externalId: `call:${params.CallSid || Date.now()}`,
    fromPhone: from,
    body: "Inbound call",
    at: new Date(),
  });

  const canForward = (mode === "forward" || mode === "both") && owner;
  if (canForward && mode === "forward") return twiml(`<Dial timeout="20">${owner}</Dial>`);
  if (canForward && mode === "both") {
    const action = `${publicOrigin(req)}/api/webhooks/twilio/voice/status`;
    return twiml(`<Dial timeout="20" action="${action}" method="POST">${owner}</Dial>`);
  }

  if (result.status !== "duplicate" && result.lead?.customerPhone) {
    await sendMissedText(db, shop, result.lead);
  }
  return twiml(say);
}
