import { json } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { DEFAULT_EMAIL_TEMPLATE, DEFAULT_SMS_TEMPLATE } from "@/lib/presets";
import { keywordList } from "@/lib/rules";
import { currentShop } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const ctx = await currentShop().catch((error) => ({ error }));
  if (ctx?.error) return json({ error: ctx.error.message }, 500);
  if (!ctx?.shop) return json({ error: "Sign in required." }, 401);

  const body = await req.json().catch(() => ({}));
  const nudgeHours = [4, 24, 48, 72].includes(Number(body.nudgeHours)) ? Number(body.nudgeHours) : 24;
  const reviewUrl = String(body.reviewUrl || "").trim();
  if (reviewUrl && !/^https?:\/\//i.test(reviewUrl)) {
    return json({ error: "Review link must start with http:// or https://." }, 400);
  }
  const ownerMobile = String(body.ownerMobile || "").trim() ? normalizePhone(body.ownerMobile) : "";
  if (String(body.ownerMobile || "").trim() && !ownerMobile) {
    return json({ error: "Owner mobile should include the area code." }, 400);
  }

  const settings = {
    nudgeHours,
    notifySms: Boolean(body.notifySms),
    notifyEmail: Boolean(body.notifyEmail),
    reviewUrl,
    emailTemplate: String(body.emailTemplate || DEFAULT_EMAIL_TEMPLATE).slice(0, 2000),
    smsTemplate: String(body.smsTemplate || DEFAULT_SMS_TEMPLATE).slice(0, 500),
    autoAckNewQuotesOnly: Boolean(body.autoAckNewQuotesOnly),
    quietHours: Boolean(body.quietHours),
    ownerMobile,
    leadKeywords: keywordList(body.leadKeywords),
    skipKeywords: keywordList(body.skipKeywords),
  };
  const update = { settings };
  if (ctx.shop.phone?.twilioNumber) update["phone.ownerMobile"] = ownerMobile;
  await ctx.db.collection("shops").updateOne({ _id: ctx.shop._id }, { $set: update });
  return json({ ok: true });
}
