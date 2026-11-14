import { json, twiml } from "@/lib/http";
import { ingestInbound, setLeadStatus } from "@/lib/ingest";
import { getDb } from "@/lib/mongo";
import { sendSms, twilioSignatureOk } from "@/lib/outbound";
import { normalizePhone } from "@/lib/phone";
import { parseStatusCode } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function shopForNumber(db, raw) {
  const number = normalizePhone(raw);
  if (!number) return null;
  return db.collection("shops").findOne({ "phone.twilioNumber": number });
}

export async function POST(req) {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  if (!twilioSignatureOk(req, params)) return json({ error: "Invalid signature" }, 403);

  const db = await getDb();
  const shop = await shopForNumber(db, params.To);
  if (!shop) return twiml();

  const from = normalizePhone(params.From);
  const body = String(params.Body || "").trim();
  const owner = normalizePhone(shop.phone?.ownerMobile || shop.settings?.ownerMobile);

  if (owner && from === owner) {
    const code = parseStatusCode(body);
    if (!code) return twiml();
    const lead = await db.collection("leads").findOne({ shopId: shop._id, number: code.number });
    if (!lead) {
      await sendSms(shop, owner, `No lead #${code.number}.`);
      return twiml();
    }
    const result = await setLeadStatus(db, shop, lead, code.status);
    await sendSms(shop, owner, result.toast || `Lead #${lead.number} marked ${result.status}.`);
    return twiml();
  }

  if (/^help$/i.test(body)) {
    await sendSms(shop, from, `${shop.name}: reply with what you need a quote for. Reply STOP to opt out.`);
    return twiml();
  }
  if (/^(stop|start|unstop)$/i.test(body) || !body) return twiml();

  await ingestInbound(db, shop, {
    channel: "sms",
    externalId: `sms:${params.MessageSid || Date.now()}`,
    fromPhone: from,
    body,
    at: new Date(),
  });
  return twiml();
}
