import { DEFAULT_LEAD_KEYWORDS, keywordList } from "./rules";

export const PRESETS = {
  generic: {
    label: "Generic IMAP",
    imapHost: "",
    imapPort: 993,
    smtpHost: "",
    smtpPort: 465,
  },
  hostinger: {
    label: "Hostinger",
    imapHost: "imap.hostinger.com",
    imapPort: 993,
    smtpHost: "smtp.hostinger.com",
    smtpPort: 465,
  },
  doteasy: {
    label: "Doteasy",
    imapHost: "mail.doteasy.com",
    imapPort: 993,
    smtpHost: "mail.doteasy.com",
    smtpPort: 465,
  },
  gmail: {
    label: "Gmail IMAP",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
  },
  outlook: {
    label: "Outlook IMAP",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
  },
};

export const DEFAULT_EMAIL_TEMPLATE =
  'Hi {{first_name}}, we got your estimate request about "{{subject}}". We\'ll review and reply shortly. — {{shop_name}}';

export const DEFAULT_SMS_TEMPLATE =
  "{{shop_name}}: got your message. We'll get back to you shortly.";

export function defaultSettings() {
  return {
    nudgeHours: 24,
    notifySms: true,
    notifyEmail: true,
    reviewUrl: "",
    emailTemplate: DEFAULT_EMAIL_TEMPLATE,
    smsTemplate: DEFAULT_SMS_TEMPLATE,
    autoAckNewQuotesOnly: true,
    quietHours: true,
    ownerMobile: "",
    leadKeywords: [...DEFAULT_LEAD_KEYWORDS],
    leadKeywordsSet: true,
    skipKeywords: [],
  };
}

export async function ensureLeadKeywords(db, shop) {
  const settings = shop.settings || {};
  if (settings.leadKeywordsSet) {
    const stored = keywordList(settings.leadKeywords);
    return stored.length ? stored : [...DEFAULT_LEAD_KEYWORDS];
  }
  const leadKeywords = keywordList([...DEFAULT_LEAD_KEYWORDS, ...keywordList(settings.leadKeywords)].join("\n"));
  const result = await db.collection("shops").updateOne(
    { _id: shop._id, "settings.leadKeywordsSet": { $ne: true } },
    { $set: { "settings.leadKeywords": leadKeywords, "settings.leadKeywordsSet": true } }
  );
  if (!result.modifiedCount) {
    const fresh = await db.collection("shops").findOne({ _id: shop._id }, { projection: { "settings.leadKeywords": 1, "settings.leadKeywordsSet": 1 } });
    const saved = keywordList(fresh?.settings?.leadKeywords);
    shop.settings = { ...settings, ...(fresh?.settings || {}), leadKeywords: saved.length ? saved : leadKeywords };
    return shop.settings.leadKeywords;
  }
  shop.settings = { ...settings, leadKeywords, leadKeywordsSet: true };
  return leadKeywords;
}

export function resolveMailbox(input) {
  const preset = PRESETS[input.preset] || PRESETS.generic;
  const imapPort = Number(input.imapPort || preset.imapPort || 993);
  const smtpPort = Number(input.smtpPort || preset.smtpPort || 465);
  return {
    preset: PRESETS[input.preset] ? input.preset : "generic",
    imapHost: String(input.imapHost || preset.imapHost || "").trim(),
    imapPort,
    smtpHost: String(input.smtpHost || preset.smtpHost || "").trim(),
    smtpPort,
    tls: input.tls !== false && input.tls !== "false",
    username: String(input.email || "").trim().toLowerCase(),
    password: String(input.password || ""),
  };
}
