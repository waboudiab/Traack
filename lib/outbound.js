import twilio from "twilio";
import { decrypt } from "./crypto";
import { sendGmail, gmailAccessToken, trashGmailThread } from "./gmail";
import { sendSmtp } from "./mail";
import { firstName, safeHeader } from "./phone";
import { renderTemplate } from "./rules";
import { quietHoursActive } from "./time";
import { APP_NAME } from "./brand";

export function twilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export function twilioSignatureOk(req, params) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return process.env.NODE_ENV !== "production";
  const signature = req.headers.get("x-twilio-signature") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const url = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;
  return twilio.validateRequest(token, signature, url, params);
}

export async function sendSms(shop, to, body) {
  const client = twilioClient();
  const from = shop.phone?.twilioNumber;
  if (!client || !from || !to) return { ok: false, reason: "sms_unavailable" };
  const message = await client.messages.create({ from, to, body: String(body).slice(0, 1000) });
  return { ok: true, sid: message.sid };
}

async function mailbox(shop) {
  const connect = shop.emailConnect;
  if (!connect) return null;
  if (connect.type === "gmail" && connect.refreshTokenEnc) {
    const refresh = decrypt(connect.refreshTokenEnc);
    const token = await gmailAccessToken(refresh);
    return { type: "gmail", token, from: connect.username };
  }
  if (connect.passwordEnc && connect.imapHost) {
    return {
      type: "imap",
      box: {
        imapHost: connect.imapHost,
        imapPort: connect.imapPort,
        smtpHost: connect.smtpHost,
        smtpPort: connect.smtpPort,
        username: connect.username,
        password: decrypt(connect.passwordEnc),
      },
    };
  }
  return null;
}

function threadIdsFor(messages) {
  const ids = new Set();
  for (const message of messages) {
    const stored = String(message.threadId || "");
    const fromUrl = threadFromOpenUrl(message.openUrl);
    for (const id of [stored, fromUrl]) {
      if (/^[A-Za-z0-9_-]{8,80}$/.test(id)) ids.add(id);
    }
  }
  return [...ids];
}

export async function trashLeadThread(db, shop, lead) {
  const mail = await mailbox(shop);
  if (!mail || mail.type !== "gmail") return { ok: false, reason: "gmail_only" };
  const messages = await db.collection("messages").find({ leadId: lead._id }).project({ threadId: 1, openUrl: 1 }).toArray();
  const threadIds = threadIdsFor(messages);
  if (!threadIds.length) return { ok: false, reason: "no_thread" };
  let trashed = 0;
  for (const threadId of threadIds) {
    try {
      await trashGmailThread(mail.token, threadId);
      trashed += 1;
    } catch (error) {
      const missing = /not found|404/i.test(String(error?.message || ""));
      if (!missing) throw error;
      trashed += 1;
    }
  }
  await db.collection("leads").updateOne({ _id: lead._id }, { $set: { threadTrashedAt: new Date(), updatedAt: new Date() } });
  return { ok: true, trashed };
}

export async function sendEmail(shop, { to, toName, subject, text, threadId, inReplyTo }) {
  const mail = await mailbox(shop);
  if (!mail || !to) return { ok: false, reason: "email_unavailable" };
  if (mail.type === "gmail") {
    await sendGmail({
      token: mail.token,
      from: mail.from,
      fromName: shop.name,
      to,
      toName,
      subject,
      text,
      threadId,
      inReplyTo,
    });
    return { ok: true };
  }
  await sendSmtp({ box: mail.box, to, subject, text });
  return { ok: true };
}

function threadFromOpenUrl(url) {
  const match = String(url || "").match(/#inbox\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function rfcFromExternal(externalId) {
  const value = String(externalId || "");
  return value.startsWith("email:") ? value.slice("email:".length) : "";
}

async function replyTarget(db, leadId) {
  const inbound = await db
    .collection("messages")
    .find({ leadId, direction: "in" })
    .sort({ at: -1 })
    .limit(1)
    .next();
  if (!inbound) return { threadId: "", rfcMessageId: "" };
  return {
    threadId: inbound.threadId || threadFromOpenUrl(inbound.openUrl),
    rfcMessageId: inbound.rfcMessageId || rfcFromExternal(inbound.externalId),
    at: inbound.at,
    fromEmail: inbound.from || "",
    subject: inbound.subject || "",
    body: inbound.body || "",
  };
}

function replyText(body, reply, lead) {
  const original = String(reply?.body || reply?.subject || "").trim();
  if (!original) return body;
  const name = lead?.customerName && lead.customerName !== "Unknown" ? lead.customerName : "";
  const email = reply.fromEmail || lead?.customerEmail || "";
  const who = name && email ? `${name} <${email}>` : name || email || "the customer";
  const when = reply.at
    ? new Date(reply.at).toLocaleString("en-US", {
        timeZone: process.env.SHOP_TIMEZONE || "America/Toronto",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
  const quoted = original.split("\n").map((line) => `> ${line}`).join("\n");
  const intro = when ? `On ${when}, ${who} wrote:` : `${who} wrote:`;
  return `${body}\n\n${intro}\n${quoted}`;
}

export async function sendMissedThreadReplies(db, shop) {
  const leads = await db
    .collection("leads")
    .find({ shopId: shop._id, channel: "email", ackedAt: { $ne: null } })
    .limit(10)
    .toArray();
  for (const lead of leads) {
    const threaded = await db.collection("messages").findOne({ leadId: lead._id, direction: "out", threaded: true });
    if (threaded || !lead.customerEmail) continue;
    const reply = await replyTarget(db, lead._id);
    if (!reply.threadId && !reply.rfcMessageId) continue;
    const body = renderTemplate(shop.settings?.emailTemplate, varsFor(shop, lead));
    const subject = `Re: ${safeHeader(lead.subject || "your estimate request")}`;
    try {
      const sent = await sendEmail(shop, {
        to: lead.customerEmail,
        toName: lead.customerName,
        subject,
        text: replyText(body, reply, lead),
        threadId: reply.threadId,
        inReplyTo: reply.rfcMessageId,
      });
      if (!sent.ok) continue;
      await recordOutbound(db, shop, lead, {
        channel: "email",
        body,
        to: lead.customerEmail,
        externalId: `ack-thread:${lead._id}`,
        threaded: true,
      });
    } catch (error) {
      console.error("thread reply", lead.customerEmail, error);
    }
  }
}

function varsFor(shop, lead) {
  return {
    first_name: firstName(lead.customerName),
    subject: lead.subject || "your message",
    shop_name: shop.name,
  };
}

async function recordOutbound(db, shop, lead, { channel, body, to, externalId, threaded }) {
  try {
    await db.collection("messages").insertOne({
      shopId: shop._id,
      leadId: lead._id,
      direction: "out",
      channel,
      body,
      at: new Date(),
      externalId,
      from: channel === "email" ? shop.emailConnect?.username || shop.email : shop.phone?.twilioNumber,
      to,
      threaded: Boolean(threaded),
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
}

export async function sendAck(db, shop, lead) {
  if (quietHoursActive(shop.settings)) return { ok: false, reason: "quiet_hours" };
  const vars = varsFor(shop, lead);
  try {
    if (lead.channel === "email" && lead.customerEmail) {
      const reply = await replyTarget(db, lead._id);
      const body = renderTemplate(shop.settings.emailTemplate, vars);
      const subject = `Re: ${safeHeader(lead.subject || "your estimate request")}`;
      const sent = await sendEmail(shop, {
        to: lead.customerEmail,
        toName: lead.customerName,
        subject,
        text: replyText(body, reply, lead),
        threadId: reply.threadId,
        inReplyTo: reply.rfcMessageId,
      });
      if (!sent.ok) return sent;
      await recordOutbound(db, shop, lead, {
        channel: "email",
        body,
        to: lead.customerEmail,
        externalId: `ack:${lead._id}:${Date.now()}`,
        threaded: Boolean(reply.threadId),
      });
      return { ok: true };
    }
    if (lead.customerPhone) {
      const body = renderTemplate(shop.settings.smsTemplate, vars);
      const sent = await sendSms(shop, lead.customerPhone, body);
      if (!sent.ok) return sent;
      await recordOutbound(db, shop, lead, {
        channel: "sms",
        body,
        to: lead.customerPhone,
        externalId: `ack:${lead._id}:${Date.now()}`,
      });
      return { ok: true };
    }
    return { ok: false, reason: "no_destination" };
  } catch (error) {
    console.error("ack", error);
    return { ok: false, reason: "send_failed" };
  }
}

export async function sendReview(db, shop, lead) {
  const url = String(shop.settings?.reviewUrl || "").trim();
  if (!url) return { ok: false, reason: "no_url" };
  const body = `Thanks ${firstName(lead.customerName)}. Here is our Google Maps link: ${url}`;
  try {
    if (lead.channel === "email" && lead.customerEmail) {
      const reply = await replyTarget(db, lead._id);
      const sent = await sendEmail(shop, {
        to: lead.customerEmail,
        toName: lead.customerName,
        subject: `Re: ${safeHeader(lead.subject || "your visit")}`,
        text: replyText(body, reply, lead),
        threadId: reply.threadId,
        inReplyTo: reply.rfcMessageId,
      });
      if (!sent.ok) return sent;
      await recordOutbound(db, shop, lead, {
        channel: "email",
        body,
        to: lead.customerEmail,
        externalId: `review:${lead._id}`,
        threaded: Boolean(reply.threadId || reply.rfcMessageId),
      });
      return { ok: true };
    }
    if (!lead.customerPhone) return { ok: false, reason: "no_destination" };
    const sent = await sendSms(shop, lead.customerPhone, body);
    if (!sent.ok) return sent;
    await recordOutbound(db, shop, lead, {
      channel: "sms",
      body,
      to: lead.customerPhone,
      externalId: `review:${lead._id}`,
    });
    return { ok: true };
  } catch (error) {
    console.error("review", error);
    return { ok: false, reason: "send_failed" };
  }
}

export async function sendMissedText(db, shop, lead) {
  const body = `${shop.name}: Sorry we missed you — text us details or reply here.`;
  const sent = await sendSms(shop, lead.customerPhone, body);
  if (!sent.ok) return sent;
  await recordOutbound(db, shop, lead, {
    channel: "sms",
    body,
    to: lead.customerPhone,
    externalId: `miss:${lead._id}:${Date.now()}`,
  });
  return { ok: true };
}

export async function notifyOwner(shop, text, options = {}) {
  const settings = shop.settings || {};
  const mobile = shop.phone?.ownerMobile || settings.ownerMobile;
  if (options.sms !== false && mobile) {
    const sms = await sendSms(shop, mobile, text).catch((error) => {
      console.error("owner sms", error);
      return { ok: false };
    });
    if (sms.ok) return { ok: true };
  }
  if (options.email !== false && shop.email) {
    try {
      const email = await sendEmail(shop, {
        to: shop.email,
        subject: `${APP_NAME} lead`,
        text,
      });
      return email;
    } catch (error) {
      console.error("owner email", error);
    }
  }
  return { ok: false };
}
