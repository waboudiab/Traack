import { safeHeader } from "./phone";
import { isAppMessage } from "./rules";

export function googleRedirectUri(origin) {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/connect/google/callback`;
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl({ origin, state }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", googleRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set(
    "scope",
    [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.send",
    ].join(" ")
  );
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(body) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google token request failed");
  return data;
}

export function googleSignInUrl({ origin, state }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode({ origin, code, redirectUri }) {
  return tokenRequest({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri || googleRedirectUri(origin),
    grant_type: "authorization_code",
  });
}

export async function gmailAccessToken(refreshToken) {
  const data = await tokenRequest({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return data.access_token;
}

async function gmailFetch(token, path, options = {}) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || "Gmail request failed");
  return data;
}

function decodeBase64(value) {
  if (!value) return "";
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function header(headers, name) {
  return headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function automatedHeaders(headers) {
  if (header(headers, "List-Unsubscribe") || header(headers, "List-Id")) return true;
  if (/bulk|list|junk/i.test(header(headers, "Precedence"))) return true;
  const auto = header(headers, "Auto-Submitted");
  return Boolean(auto) && !/^no$/i.test(auto.trim());
}

function htmlToText(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function plainText(payload) {
  const plain = [];
  const html = [];
  const walk = (part) => {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) plain.push(decodeBase64(part.body.data));
    else if (part.mimeType === "text/html" && part.body?.data) html.push(htmlToText(decodeBase64(part.body.data)));
    for (const child of part.parts || []) walk(child);
  };
  walk(payload);
  if (plain.length) return plain.join("\n").trim();
  if (html.length) return html.join("\n").trim();
  return "";
}

function parseFrom(raw) {
  const match = String(raw).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  return { name: "", email: String(raw).trim().toLowerCase() };
}

export async function googleEmail(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Could not read the Google account email");
  return String(data.email || "").toLowerCase();
}

export async function listMatching(token, query) {
  const listed = await gmailFetch(token, `/messages?q=${encodeURIComponent(query)}&maxResults=20`);
  const messages = [];
  for (const item of listed.messages || []) {
    const full = await gmailFetch(token, `/messages/${item.id}?format=full`);
    const headers = full.payload?.headers || [];
    const from = parseFrom(header(headers, "From"));
    messages.push({
      id: full.id,
      threadId: full.threadId,
      fromEmail: from.email,
      fromName: from.name,
      subject: header(headers, "Subject"),
      body: plainText(full.payload),
      messageId: header(headers, "Message-Id") || full.id,
      automated: automatedHeaders(headers),
      at: header(headers, "Date") ? new Date(header(headers, "Date")) : new Date(),
    });
  }
  return messages;
}

export async function trashGmailThread(token, threadId) {
  await gmailFetch(token, `/threads/${encodeURIComponent(threadId)}/trash`, {
    method: "POST",
    body: "{}",
  });
}

export async function markGmailRead(token, id) {
  await gmailFetch(token, `/messages/${id}/modify`, {
    method: "POST",
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}

function appSent({ subject, snippet, auto }) {
  if (auto) return true;
  const text = `${subject || ""}\n${snippet || ""}`;
  if (isAppMessage({ subject, body: snippet })) return true;
  return /we got your estimate request|got your message|sorry we missed you|here is our google maps link/i.test(text);
}

export async function listSent(token) {
  const listed = await gmailFetch(token, "/messages?q=in:sent%20newer_than:2d&maxResults=20");
  const sent = [];
  for (const item of listed.messages || []) {
    const meta = await gmailFetch(
      token,
      `/messages/${item.id}?format=metadata&metadataHeaders=To&metadataHeaders=Date&metadataHeaders=Subject&metadataHeaders=X-Traack-Auto`
    );
    const headers = meta.payload?.headers || [];
    if (appSent({ subject: header(headers, "Subject"), snippet: meta.snippet, auto: header(headers, "X-Traack-Auto") })) continue;
    const toRaw = header(headers, "To");
    const at = header(headers, "Date") ? new Date(header(headers, "Date")) : new Date();
    for (const piece of toRaw.split(",")) {
      const email = parseFrom(piece).email;
      if (email) sent.push({ toEmail: email, at });
    }
  }
  return sent;
}

function mailboxHeader(name, email) {
  const addr = safeHeader(email);
  const label = safeHeader(name).replace(/["\\]/g, "");
  if (!addr) return "";
  if (!label || label.includes("@")) return addr;
  return `"${label}" <${addr}>`;
}

function mailDate(date = new Date()) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

function quotedPrintable(text) {
  const lines = [];
  for (const source of String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
    let line = "";
    const bytes = Buffer.from(source, "utf8");
    bytes.forEach((byte, index) => {
      const trailing = index === bytes.length - 1 && byte === 32;
      const chunk = trailing || byte === 61 || byte < 32 || byte > 126
        ? `=${byte.toString(16).toUpperCase().padStart(2, "0")}`
        : String.fromCharCode(byte);
      if (line.length + chunk.length > 73) {
        lines.push(`${line}=`);
        line = "";
      }
      line += chunk;
    });
    lines.push(line);
  }
  return lines.join("\r\n");
}

export async function sendGmail({ token, from, fromName, to, toName, subject, text, html, threadId, inReplyTo, auto }) {
  const replyId = safeHeader(inReplyTo);
  const reply = replyId.includes("@") ? `In-Reply-To: ${replyId}\r\nReferences: ${replyId}\r\n` : "";
  const mark = auto ? `X-Traack-Auto: ${safeHeader(auto)}\r\n` : "";
  const headers = `Date: ${mailDate()}\r\nFrom: ${mailboxHeader(fromName, from)}\r\nTo: ${mailboxHeader(toName, to)}\r\nSubject: ${safeHeader(subject)}\r\n${reply}${mark}MIME-Version: 1.0\r\n`;
  const rawBody = html
    ? `${headers}Content-Type: multipart/alternative; boundary="traack_alt"\r\n\r\n--traack_alt\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${quotedPrintable(text)}\r\n--traack_alt\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${quotedPrintable(html)}\r\n--traack_alt--`
    : `${headers}Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${quotedPrintable(text)}`;
  const raw = Buffer.from(rawBody).toString("base64url");
  const payload = { raw };
  if (threadId) payload.threadId = threadId;
  await gmailFetch(token, "/messages/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
