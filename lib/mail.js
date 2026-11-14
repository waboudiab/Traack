import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { safeHeader } from "./phone";

function imapClient(box) {
  return new ImapFlow({
    host: box.imapHost,
    port: Number(box.imapPort),
    secure: Number(box.imapPort) === 993,
    auth: { user: box.username, pass: box.password },
    logger: false,
    connectionTimeout: 15000,
  });
}

export function smtpTransport(box) {
  const port = Number(box.smtpPort);
  const secure = port === 465;
  return nodemailer.createTransport({
    host: box.smtpHost,
    port,
    secure,
    requireTLS: !secure && box.tls !== false,
    auth: { user: box.username, pass: box.password },
  });
}

export async function testMailbox(box) {
  if (!box.imapHost || !box.smtpHost) {
    throw new Error("Enter IMAP and SMTP hosts, or choose a preset.");
  }
  if (!box.username || !box.password) {
    throw new Error("Email and password are required.");
  }
  const client = imapClient(box);
  await client.connect();
  try {
    await client.mailboxOpen("INBOX");
  } finally {
    await client.logout().catch(() => {});
  }
  await smtpTransport(box).verify();
}

export async function sendSmtp({ box, to, subject, text, html, auto }) {
  await smtpTransport(box).sendMail({
    from: box.username,
    to,
    subject: safeHeader(subject),
    text,
    html,
    headers: auto ? { "X-Traack-Auto": auto } : undefined,
  });
}

function addressList(list) {
  return (list || []).map((item) => ({
    email: String(item.address || "").toLowerCase(),
    name: item.name || "",
  }));
}

export async function readUnseen(box) {
  const client = imapClient(box);
  await client.connect();
  try {
    const messages = [];
    let lock;
    try {
      lock = await client.getMailboxLock("INBOX");
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const uids = (await client.search({ since }, { uid: true })) || [];
      const batch = uids.slice(-25);
      if (batch.length) {
        for await (const msg of client.fetch(
          batch,
          { envelope: true, source: true, uid: true },
          { uid: true }
        )) {
          const parsed = await simpleParser(msg.source);
          const from = addressList(parsed.from?.value)[0] || { email: "", name: "" };
          messages.push({
            uid: msg.uid,
            fromEmail: from.email,
            fromName: from.name,
            subject: parsed.subject || "",
            body: parsed.text || stripHtml(parsed.html) || "",
            messageId: parsed.messageId || `uid:${msg.uid}`,
            automated: automatedParsed(parsed),
            at: parsed.date || new Date(),
          });
        }
      }
    } finally {
      lock?.release();
    }

    return {
      messages,
      async markSeen(uids) {
        if (!uids.length) return;
        const seenLock = await client.getMailboxLock("INBOX");
        try {
          await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
        } finally {
          seenLock.release();
        }
      },
      async sentReplies() {
        return readSent(client);
      },
      async close() {
        await client.logout().catch(() => {});
      },
    };
  } catch (error) {
    await client.logout().catch(() => {});
    throw error;
  }
}

async function readSent(client) {
  try {
    const boxes = await client.list();
    const paths = boxes.map((box) => box.path);
    const preferred = ["Sent", "Sent Items", "INBOX.Sent", "[Gmail]/Sent Mail"];
    const path = preferred.find((item) => paths.includes(item)) || paths.find((item) => /sent/i.test(item));
    if (!path) return [];
    const lock = await client.getMailboxLock(path);
    try {
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const uids = (await client.search({ since }, { uid: true })) || [];
      const recent = uids.slice(-25);
      const sent = [];
      if (!recent.length) return sent;
      for await (const msg of client.fetch(recent, { envelope: true, uid: true }, { uid: true })) {
        const tos = msg.envelope?.to || [];
        for (const to of tos) {
          if (!to.address) continue;
          sent.push({
            toEmail: String(to.address).toLowerCase(),
            at: msg.envelope.date || new Date(),
          });
        }
      }
      return sent;
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("sent mailbox", error);
    return [];
  }
}

function headerValue(parsed, name) {
  const value = parsed.headers?.get?.(name);
  if (Array.isArray(value)) return value.join(" ");
  return String(value || "");
}

function automatedParsed(parsed) {
  if (headerValue(parsed, "list-unsubscribe") || headerValue(parsed, "list-id")) return true;
  if (/bulk|list|junk/i.test(headerValue(parsed, "precedence"))) return true;
  const auto = headerValue(parsed, "auto-submitted");
  return Boolean(auto) && !/^no$/i.test(auto.trim());
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
