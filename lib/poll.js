import { decrypt } from "./crypto";
import { gmailAccessToken, listMatching, listSent, markGmailRead } from "./gmail";
import { flushAcks, ingestInbound, markOwnerReplies } from "./ingest";
import { readUnseen } from "./mail";
import { nudgeMs, quietHoursActive } from "./time";
import { notifyOwner, sendMissedThreadReplies } from "./outbound";
import { sendShopPush } from "./push";
import { statusLink } from "./status-link";
import { leadMailQuery } from "./rules";
import { APP_NAME } from "./brand";

export async function pollShop(db, shop) {
  const connect = shop.emailConnect;
  if (!connect) return { ingested: 0 };
  if (connect.type === "gmail") return pollGmail(db, shop);
  return pollImap(db, shop);
}

async function pollImap(db, shop) {
  const connect = shop.emailConnect;
  const box = {
    imapHost: connect.imapHost,
    imapPort: connect.imapPort,
    smtpHost: connect.smtpHost,
    smtpPort: connect.smtpPort,
    username: connect.username,
    password: decrypt(connect.passwordEnc),
  };
  const mailbox = await readUnseen(box);
  const seen = [];
  let ingested = 0;
  try {
    for (const message of mailbox.messages) {
      const result = await ingestInbound(db, shop, {
        channel: "email",
        externalId: `email:${message.messageId}`,
        fromEmail: message.fromEmail,
        fromName: message.fromName,
        subject: message.subject,
        body: message.body,
        automated: message.automated,
        at: message.at,
      });
      if (result.status !== "dropped") ingested += 1;
      seen.push(message.uid);
    }
    await mailbox.markSeen(seen);
    const sent = await mailbox.sentReplies();
    await markOwnerReplies(db, shop._id, sent);
  } finally {
    await mailbox.close();
  }
  await flushAcks(db, shop);
  return { ingested };
}

async function pollGmail(db, shop) {
  const token = await gmailAccessToken(decrypt(shop.emailConnect.refreshTokenEnc));
  const messages = await listMatching(token, leadMailQuery(shop.settings?.leadKeywords));
  let ingested = 0;
  for (const message of messages) {
    const result = await ingestInbound(db, shop, {
      channel: "email",
      externalId: `email:${message.messageId}`,
      fromEmail: message.fromEmail,
      fromName: message.fromName,
      subject: message.subject,
      body: message.body,
      automated: message.automated,
      at: message.at,
      threadId: message.threadId || "",
      rfcMessageId: message.messageId || "",
      openUrl: message.threadId ? `https://mail.google.com/mail/u/0/#inbox/${message.threadId}` : "",
    });
    if (result.status !== "dropped") ingested += 1;
    await markGmailRead(token, message.id);
  }
  const sent = await listSent(token);
  await markOwnerReplies(db, shop._id, sent);
  await flushAcks(db, shop);
  await sendMissedThreadReplies(db, shop);
  return { ingested };
}

function ownerAlreadyReplied(lead) {
  if (!lead.ownerRepliedAt || !lead.lastCustomerAt) return false;
  const replied = new Date(lead.ownerRepliedAt).getTime();
  const customer = new Date(lead.lastCustomerAt).getTime();
  if (Number.isNaN(replied) || Number.isNaN(customer) || replied < customer) return false;
  for (const stamp of [lead.ackedAt, lead.reviewSentAt]) {
    if (!stamp) continue;
    const sent = new Date(stamp).getTime();
    if (!Number.isNaN(sent) && Math.abs(replied - sent) < 5 * 60 * 1000) return false;
  }
  return true;
}

function reminderLinks(lead) {
  const origin = String(process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  if (!origin) return [];
  return [
    ["Pending", "pending"],
    ["Done", "done"],
    ["Declined", "declined"],
  ].map(([label, status]) => ({
    label,
    status,
    url: statusLink(origin, { leadId: lead._id, status }),
  }));
}

export async function nudgeShop(db, shop) {
  if (quietHoursActive(shop.settings)) return { nudged: 0 };
  const wait = nudgeMs(shop.settings?.nudgeHours);
  const cutoff = new Date(Date.now() - wait);
  const leads = await db
    .collection("leads")
    .find({
      shopId: shop._id,
      status: { $in: ["new", "pending"] },
      nudgeStopped: { $ne: true },
      lastCustomerAt: { $lte: cutoff },
    })
    .limit(30)
    .toArray();

  let nudged = 0;
  for (const lead of leads) {
    if (ownerAlreadyReplied(lead)) continue;
    if (lead.nudgeFor && lead.lastCustomerAt && new Date(lead.nudgeFor) >= new Date(lead.lastCustomerAt)) continue;
    const allowSms = shop.settings?.notifySms !== false;
    const allowEmail = shop.settings?.notifyEmail !== false;
    const who = lead.customerName || lead.customerPhone || lead.customerEmail || "a customer";
    const text = `${APP_NAME}: lead #${lead.number} from ${who} still has no shop reply. ${lead.snippet || ""}`.trim();
    const links = reminderLinks(lead);
    const sent = allowSms || allowEmail
      ? await notifyOwner(shop, text, {
          sms: allowSms,
          email: allowEmail,
          all: true,
          subject: `${APP_NAME}: lead #${lead.number} still needs a reply`,
          links,
          auto: "nudge",
        })
      : { ok: false };
    const push = await sendShopPush(db, shop._id, {
      title: "Reminder",
      body: text.slice(0, 180),
      url: `/leads/${lead._id}`,
      leadId: String(lead._id),
      actions: [
        { action: "pending", title: "Pending" },
        { action: "done", title: "Done" },
        { action: "declined", title: "Declined" },
      ],
    });
    if (sent.ok || push?.sent) {
      await db.collection("leads").updateOne(
        { _id: lead._id },
        { $set: { nudgeFor: lead.lastCustomerAt, nudgeSentAt: new Date() } }
      );
      nudged += 1;
    }
  }
  return { nudged };
}
