import { ObjectId } from "mongodb";
import { classifyAi } from "./ai";
import { docOf } from "./mongo";
import { displayName, extractPhone, oneLine } from "./phone";
import { notifyOwner, sendAck, sendReview } from "./outbound";
import { APP_NAME } from "./brand";
import { sendShopPush } from "./push";
import { ensureLeadKeywords } from "./presets";
import { classifyCheap, isAppMessage, localNote } from "./rules";

async function nextNumber(db, shopId) {
  const result = await db.collection("shops").findOneAndUpdate(
    { _id: shopId },
    { $inc: { nextLeadNumber: 1 } },
    { returnDocument: "before" }
  );
  const doc = docOf(result);
  return doc?.nextLeadNumber || 100;
}

async function findOpenLead(db, shopId, { email, phone }) {
  const query = { shopId, status: { $in: ["new", "pending"] } };
  if (email) query.customerEmail = email;
  else if (phone) query.customerPhone = phone;
  else return null;
  return db.collection("leads").find(query).sort({ lastCustomerAt: -1 }).limit(1).next();
}

export async function markOwnerReplies(db, shopId, sent) {
  const outbound = await db
    .collection("messages")
    .find({
      shopId,
      direction: "out",
      at: { $gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    })
    .project({ to: 1, at: 1 })
    .toArray();

  for (const item of sent) {
    if (!item.toEmail || item.app) continue;
    const ours = outbound.some((message) => {
      if (String(message.to || "").toLowerCase() !== item.toEmail) return false;
      return Math.abs(new Date(message.at).getTime() - new Date(item.at).getTime()) < 3 * 60 * 1000;
    });
    if (ours) continue;
    await db.collection("leads").updateMany(
      {
        shopId,
        customerEmail: item.toEmail,
        status: { $in: ["new", "pending"] },
        lastCustomerAt: { $lte: item.at },
      },
      { $max: { ownerRepliedAt: item.at } }
    );
  }
}

export async function flushAcks(db, shop) {
  const pending = await db
    .collection("leads")
    .find({ shopId: shop._id, ackPending: true, ackedAt: null })
    .limit(20)
    .toArray();
  for (const lead of pending) {
    const sent = await sendAck(db, shop, lead);
    if (sent.ok) {
      await db.collection("leads").updateOne(
        { _id: lead._id },
        { $set: { ackedAt: new Date(), ackPending: false } }
      );
    }
  }
}

async function matchesOutbound(db, shop, incoming) {
  const text = oneLine(`${incoming.subject || ""}\n${incoming.body || ""}`, 2000);
  if (!text) return false;
  const recent = await db
    .collection("messages")
    .find({
      shopId: shop._id,
      direction: "out",
      channel: "email",
      at: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    })
    .project({ body: 1 })
    .limit(40)
    .toArray();
  return recent.some((message) => {
    const sent = oneLine(message.body, 120);
    return sent.length >= 24 && text.includes(sent);
  });
}

export async function ingestInbound(db, shop, incoming) {
  await ensureLeadKeywords(db, shop);
  const channel = incoming.channel;
  const fromEmail = String(incoming.fromEmail || "").toLowerCase();
  const ownAddress = String(shop.emailConnect?.username || "").toLowerCase();
  const isOwn = Boolean(fromEmail && ownAddress && fromEmail === ownAddress);
  const text = `${incoming.subject || ""}\n${incoming.body || ""}`;
  if (channel === "email" && isOwn && (isAppMessage(incoming) || (await matchesOutbound(db, shop, incoming)))) {
    return { status: "dropped", reason: "app_mail" };
  }

  let action = channel === "call" ? "call" : "unsure";
  let note = "";
  if (channel !== "call") {
    const cheap = classifyCheap({
      from: fromEmail,
      subject: incoming.subject,
      body: incoming.body,
      automated: Boolean(incoming.automated),
      leadKeywords: shop.settings?.leadKeywords,
      skipKeywords: shop.settings?.skipKeywords,
    });
    if (cheap.action === "drop") return { status: "dropped", reason: cheap.reason };
    action = cheap.action;
    if (action === "unsure") {
      const ai = await classifyAi(text);
      if (ai?.label === "new_quote") action = "new_quote";
      else if (ai?.label === "existing") action = "existing";
      else if (ai?.label === "ignore") return { status: "dropped", reason: "ai" };
      else if (channel === "email") return { status: "dropped", reason: "not_a_lead" };
      if (ai?.note) note = ai.note;
    }
  }
  if (!note) {
    note = localNote(
      action === "new_quote" || action === "existing" || action === "call" ? action : "unsure",
      text
    );
  }

  const phone = incoming.fromPhone || extractPhone(text);
  const openLead = await findOpenLead(db, shop._id, {
    email: channel === "email" ? fromEmail : "",
    phone: channel === "email" ? "" : phone,
  });

  if (action === "existing" && !openLead) action = "unsure";

  const at = incoming.at instanceof Date && !Number.isNaN(incoming.at.getTime()) ? incoming.at : new Date();
  const snippet = oneLine(incoming.body) || oneLine(incoming.subject) || "New lead";
  const externalId = incoming.externalId || `in:${channel}:${Date.now()}`;

  const existingMessage = await db.collection("messages").findOne({ shopId: shop._id, externalId });
  if (existingMessage) {
    const body = oneLine(incoming.body, 8000);
    const patch = {};
    if (body && !String(existingMessage.body || "").trim()) patch.body = body;
    if (incoming.threadId && !existingMessage.threadId) patch.threadId = incoming.threadId;
    if (incoming.rfcMessageId && !existingMessage.rfcMessageId) patch.rfcMessageId = incoming.rfcMessageId;
    if (Object.keys(patch).length) {
      await db.collection("messages").updateOne({ _id: existingMessage._id }, { $set: patch });
    }
    return { status: "duplicate", leadId: existingMessage.leadId };
  }

  let lead = openLead;
  let created = false;
  if (!lead) {
    const number = await nextNumber(db, shop._id);
    const customerName = displayName(incoming.fromName, fromEmail, phone);
    const insert = {
      shopId: shop._id,
      number,
      channel,
      status: "new",
      hot: action === "new_quote" || channel === "call",
      customerName,
      customerEmail: fromEmail,
      customerPhone: phone,
      subject: incoming.subject || "",
      snippet,
      aiNote: note,
      unreadCount: 1,
      lastCustomerAt: at,
      createdAt: at,
      updatedAt: new Date(),
      ackedAt: null,
      ackPending: false,
      reviewSentAt: null,
    };
    const result = await db.collection("leads").insertOne(insert);
    lead = { ...insert, _id: result.insertedId };
    created = true;
  } else if (action === "new_quote" || channel === "call") {
    await db.collection("leads").updateOne(
      { _id: lead._id },
      {
        $set: {
          hot: true,
          snippet,
          aiNote: note,
          lastCustomerAt: at,
          updatedAt: new Date(),
          ...(phone && !lead.customerPhone ? { customerPhone: phone } : {}),
          ...(fromEmail && !lead.customerEmail ? { customerEmail: fromEmail } : {}),
        },
        $inc: { unreadCount: 1 },
      }
    );
    lead.lastCustomerAt = at;
    if (phone && !lead.customerPhone) lead.customerPhone = phone;
  } else {
    await db.collection("leads").updateOne(
      { _id: lead._id },
      {
        $set: {
          snippet,
          aiNote: note,
          lastCustomerAt: at,
          updatedAt: new Date(),
          ...(phone && !lead.customerPhone ? { customerPhone: phone } : {}),
        },
        $inc: { unreadCount: 1 },
      }
    );
    lead.lastCustomerAt = at;
    if (phone && !lead.customerPhone) lead.customerPhone = phone;
  }

  try {
    await db.collection("messages").insertOne({
      shopId: shop._id,
      leadId: lead._id,
      direction: "in",
      channel,
      body: oneLine(incoming.body || incoming.subject || "", 8000),
      subject: incoming.subject || "",
      at,
      externalId,
      threadId: incoming.threadId || "",
      rfcMessageId: incoming.rfcMessageId || "",
      from: fromEmail || phone,
      openUrl: incoming.openUrl || (fromEmail ? `mailto:${fromEmail}?subject=${encodeURIComponent(`Re: ${incoming.subject || ""}`)}` : ""),
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return { status: "duplicate", leadId: lead._id };
  }

  const who = lead.customerName || phone || fromEmail || "Someone";
  await sendShopPush(db, shop._id, {
    title: created ? "New lead" : "New message",
    body: `${who}: ${snippet}`.slice(0, 180),
    url: `/leads/${lead._id}`,
  });

  const shouldAck =
    channel !== "call" &&
    !lead.ackedAt &&
    (action === "new_quote" || !shop.settings?.autoAckNewQuotesOnly);

  if (shouldAck) {
    const sent = await sendAck(db, shop, lead);
    await db.collection("leads").updateOne(
      { _id: lead._id },
      sent.ok
        ? { $set: { ackedAt: new Date(), ackPending: false } }
        : { $set: { ackPending: true } }
    );
  }

  if (channel === "call" || (created && action === "unsure")) {
    const who = lead.customerName || phone || fromEmail;
    const text =
      channel === "call"
        ? `${APP_NAME}: call from ${phone || "unknown"}. Lead #${lead.number}.`
        : `${APP_NAME}: lead #${lead.number} from ${who} needs a look. ${snippet}`;
    await notifyOwner(shop, text);
  }

  return { status: created ? "created" : "updated", leadId: lead._id, number: lead.number, lead };
}

export async function setLeadStatus(db, shop, lead, status) {
  const allowed = ["new", "pending", "done", "declined"];
  if (!allowed.includes(status)) throw new Error("Unknown status");
  const now = new Date();
  const update = { status, updatedAt: now };
  let reviewQueued = false;
  if (status === "done" && !lead.reviewSentAt) {
    const sent = await sendReview(db, shop, lead);
    if (sent.ok) {
      update.reviewSentAt = now;
      reviewQueued = true;
    } else if (sent.reason === "no_url") {
      return {
        status: lead.status,
        toast: "Add a Google Maps link in Settings, then mark Done again.",
        reviewQueued: false,
        leftQueue: false,
      };
    } else {
      return {
        status: lead.status,
        toast: "Google Maps link could not be sent. Lead stays on the queue.",
        reviewQueued: false,
        leftQueue: false,
      };
    }
  }
  if (status === "declined") update.nudgeStopped = true;
  if (status !== "declined") update.nudgeStopped = false;
  await db.collection("leads").updateOne({ _id: lead._id }, { $set: update });

  let toast = "Status New.";
  if (status === "pending") toast = "Status Pending. Owner reminders continue.";
  if (status === "declined") toast = "Status Declined. Nudges stopped.";
  const leftQueue = status === "done" && (reviewQueued || Boolean(lead.reviewSentAt));
  if (status === "done" && reviewQueued) toast = "Google Maps link sent. This lead left the queue.";
  if (status === "done" && lead.reviewSentAt) toast = "Google Maps link already sent. This lead left the queue.";
  return { status, toast, reviewQueued, leftQueue };
}

export function leadQueryId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}
