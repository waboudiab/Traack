export function renderTemplate(template, vars) {
  return String(template || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

export const DEFAULT_LEAD_KEYWORDS = [
  "estimate",
  "quote",
  "quotation",
  "how much",
  "price",
  "pricing",
  "photo",
  "photos",
  "picture",
];

export function shopLeadKeywords(value) {
  const words = keywordList(value);
  return words.length ? words : [...DEFAULT_LEAD_KEYWORDS];
}

export function leadMailQuery(words) {
  const terms = shopLeadKeywords(words).map((word) => (/\s/.test(word) ? `"${word}"` : word));
  return `newer_than:14d (${terms.join(" OR ")})`;
}

export function keywordList(value) {
  const raw = Array.isArray(value) ? value.join("\n") : String(value || "");
  const seen = new Set();
  const words = [];
  for (const part of raw.split(/[\n,]/)) {
    const word = part.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
    if (word.length < 2 || seen.has(word)) continue;
    seen.add(word);
    words.push(word);
    if (words.length >= 60) break;
  }
  return words;
}

function containsKeyword(text, words) {
  return keywordList(words).some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });
}

const AUTO_FROM =
  /no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|mailer-daemon|notifications?|notify@|newsletter|digest|promo(?:tions?)?@|marketing@|deals@|offers?@|bounce[@.+]|mailer@|automated@/i;
const AUTO_HOST =
  /@(?:[\w-]+\.)*(?:mail|email|emails|news|newsletter|promo|marketing|offers|em|mailer|send)\.[a-z]{2,}/i;
const AUTO_SUBJECT =
  /\b(sign[\s-]?in|signed in|new device|security alert|verification code|verify your (?:email|account|identity)|password (?:reset|changed)|one-time (?:code|password|pin)|newsletter|digest|unsubscribe|your receipt|order (?:confirmation|shipped)|shipping (?:confirmation|update)|out for delivery|view in (?:your )?browser|email preferences)\b/i;
const BULK = /\bunsubscribe\b|list-unsubscribe|email preferences/i;
const EXISTING = /\b(pickup|pick up|status|invoice|ready|any update|following up)\b/i;

export function isAppMessage({ subject, body }) {
  const line = String(subject || "").replace(/\s+/g, " ").trim();
  const text = String(body || "").replace(/\s+/g, " ").trim();
  if (/^(traack|quote desk) lead$/i.test(line)) return true;
  if (/^(traack|quote desk):/i.test(text)) return true;
  if (/here is our google maps link:/i.test(text)) return true;
  return false;
}

export function classifyCheap({ from, subject, body, automated, leadKeywords, skipKeywords }) {
  const text = `${subject || ""}\n${body || ""}`.trim();
  const sender = from || "";
  if (!text) return { action: "drop", reason: "empty" };
  if (/^\s*(stop|start|unstop)\s*$/i.test(body || "")) return { action: "drop", reason: "keyword" };
  if (containsKeyword(text, skipKeywords)) return { action: "drop", reason: "shop_skip" };
  const triggers = shopLeadKeywords(leadKeywords);
  const subjectText = subject || "";
  if (containsKeyword(subjectText, triggers)) {
    return { action: "new_quote", reason: "keywords" };
  }
  if (automated || AUTO_FROM.test(sender) || AUTO_HOST.test(sender)) {
    return { action: "drop", reason: "automated" };
  }
  if (AUTO_SUBJECT.test(subjectText) || BULK.test(text)) return { action: "drop", reason: "bulk" };
  if (containsKeyword(text, triggers)) return { action: "new_quote", reason: "keywords" };
  if (EXISTING.test(text)) return { action: "existing", reason: "job_language" };
  return { action: "unsure", reason: "no_rule" };
}

export function localNote(action, text) {
  const blob = text || "";
  if (action === "new_quote") {
    const bits = [];
    if (/photo|picture|pic\b/i.test(blob)) bits.push("photos");
    if (/estimate|quote|how much|price/i.test(blob)) bits.push("estimate ask");
    return bits.length ? `new quote (${bits.join(" + ")})` : "new quote";
  }
  if (action === "existing") return "existing job update";
  if (action === "call") return "phone call";
  return "needs a look";
}

export function parseStatusCode(body) {
  const match = String(body || "").trim().match(/^#?\s*(\d+)\s*([dxp])\s*$/i);
  if (!match) return null;
  const map = { d: "done", x: "declined", p: "pending" };
  return { number: Number(match[1]), status: map[match[2].toLowerCase()] };
}
