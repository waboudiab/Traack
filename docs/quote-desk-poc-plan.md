# Quote Desk POC plan

**Status:** Ready to build once Mongo Atlas + Twilio exist.

**Working name:** QuoteAck / InboxAck / ShopQ (code may use `quotedesk`)

**One-line product:** Connect **any** shop email (IMAP) + a **phone number** (SMS/calls) → cheap filters + light AI → auto-ack new quotes → owner alert if quiet → status → Google review when Done.

## POC channels
- **Email:** IMAP (any host: Hostinger, Doteasy, cPanel, etc.). Google/Microsoft may need app password or OAuth.
- **Phone:** Twilio number for SMS + calls (forward to owner and/or missed-call text-back). No full AI voice agent in POC.

## Stack
- **JS/Node** + **Next.js** on **Vercel**
- **MongoDB Atlas**
- IMAP/SMTP (`imapflow`), optional Gmail OAuth
- **Twilio** SMS + Voice
- OpenAI classify after cheap rules
- **Vercel Cron** polls IMAP every 1–5 min (mail sits unread until next poll — leads are not lost)
- **PWA** — installable from the browser onto the phone home screen (`standalone`, service worker, manifest). This is required. It is not a native App Store app.

## POC in
Signup, connect email (IMAP + optional Google), connect phone, ingest email/SMS, cheap rules + AI, auto-ack templates, leads dashboard (unread badge), quiet-owner nudge, status New/Pending/Done/Declined, Done → review link, open latest email/SMS. **Installable PWA** (manifest, icons, service worker, standalone display).

## POC out
AI voice agent, Microsoft Graph (IMAP covers many), photo AI estimating, Stripe, custom domains, native App Store / Play Store apps.

## Related files
- UI handoff for implementer: [`quote-desk-ui-spec.md`](./quote-desk-ui-spec.md)
- Clickable prototype: [`quote-desk-ui-prototype.html`](./quote-desk-ui-prototype.html)
