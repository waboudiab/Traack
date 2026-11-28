"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import NotifyButton from "../notify-button";
import BillingBanner from "../billing-banner";

export default function SettingsForm({ settings, notifyKey, billing }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [cardNote, setCardNote] = useState(billing?.note || "");
  const [cardPending, setCardPending] = useState(false);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save settings.");
        return;
      }
      router.push("/leads");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function openCard(path) {
    setCardNote("");
    setCardPending(true);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setCardNote(data.error || "Could not open the card page.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setCardNote("Could not open the card page.");
    } finally {
      setCardPending(false);
    }
  }

  const cardOnFile = billing?.paid;
  const cardLabel = cardOnFile ? "Manage card" : "Add a card";

  return (
    <main className="screen">
      <BillingBanner message={billing?.message} />
      <p className="brand">Settings</p>
      <h2>Business setup</h2>
      <p className="lead">Nudges, review link, first-response templates.</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="card" id="billing">
        <h3 style={{ marginTop: 0 }}>Card</h3>
        <p className="hint">First month free, then $19.99 a month. The free month ends {billing?.endsLabel || "in 30 days"}.</p>
        {cardOnFile ? <p className="hint">A card is on file. $19.99 starts when the free month ends, or now if that month is already over.</p> : null}
        {!billing?.configured ? <p className="hint">Card payments are not connected on this server yet.</p> : null}
        {cardNote ? <p className="toast">{cardNote}</p> : null}
        <button className="primary" type="button" disabled={cardPending || !billing?.configured} onClick={() => openCard(cardOnFile ? "/api/billing/portal" : "/api/billing/checkout")}>
          {cardPending ? "Opening…" : cardLabel}
        </button>
      </div>
      <form onSubmit={onSubmit}>
        <h3>Owner notify if quiet</h3>
        <label className="field">
          Remind owner after
          <select value={String(form.nudgeHours)} onChange={(event) => set("nudgeHours", Number(event.target.value))}>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="240">4 hours</option>
            <option value="1440">1 day</option>
            <option value="2880">2 days</option>
            <option value="4320">3 days</option>
          </select>
        </label>
        <p className="hint">Fires when the business still has not replied. The automatic first reply does not count. The email and the phone alert include Pending, Done, and Declined. Checks run about every 15 minutes.</p>
        <div className="switch-row">
          <span>Notify by text</span>
          <input type="checkbox" checked={form.notifySms} onChange={(event) => set("notifySms", event.target.checked)} />
        </div>
        <div className="switch-row">
          <span>Notify by email</span>
          <input type="checkbox" checked={form.notifyEmail} onChange={(event) => set("notifyEmail", event.target.checked)} />
        </div>
        <NotifyButton publicKey={notifyKey || ""} />

        <h3>Google Maps link</h3>
        <label className="field">
          Maps link
          <input value={form.reviewUrl} onChange={(event) => set("reviewUrl", event.target.value)} placeholder="https://maps.app.goo.gl/your-shop" />
        </label>
        <p className="hint">Emailed when a lead is marked Done. That lead then leaves the queue.</p>

        <h3>First-response templates</h3>
        <label className="field">
          Email template
          <textarea value={form.emailTemplate} onChange={(event) => set("emailTemplate", event.target.value)} />
        </label>
        <label className="field">
          Text template
          <textarea value={form.smsTemplate} onChange={(event) => set("smsTemplate", event.target.value)} />
        </label>
        <p className="hint">{"Vars: {{first_name}} {{subject}} {{shop_name}}"}</p>

        <h3>Lead words</h3>
        <label className="field">
          Words that start a lead for this business
          <textarea
            value={form.leadKeywords || ""}
            onChange={(event) => set("leadKeywords", event.target.value)}
            placeholder={"estimate\nquote\ndent"}
          />
        </label>
        <p className="hint">Saved on this business only. One word or phrase per line, or separated by commas. An email is saved as a lead only when it contains one of these words. Leave the box empty to restore the starter list.</p>
        <label className="field">
          Skip words
          <textarea
            value={form.skipKeywords || ""}
            onChange={(event) => set("skipKeywords", event.target.value)}
            placeholder={"receipt\nnewsletter"}
          />
        </label>
        <p className="hint">A message with one of these words is not saved as a lead. Newsletters, sign-in alerts, and no-reply mail are already skipped.</p>

        <h3>Other</h3>
        <div className="switch-row">
          <span>Auto-ack new quotes only</span>
          <input type="checkbox" checked={form.autoAckNewQuotesOnly} onChange={(event) => set("autoAckNewQuotesOnly", event.target.checked)} />
        </div>
        <div className="switch-row">
          <span>Quiet hours</span>
          <input type="checkbox" checked={form.quietHours} onChange={(event) => set("quietHours", event.target.checked)} />
        </div>
        <p className="hint">Pauses auto-replies and owner nudges from 9pm to 8am.</p>
        <label className="field">
          Owner mobile
          <input value={form.ownerMobile} onChange={(event) => set("ownerMobile", event.target.value)} />
        </label>
        <button className="primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
      </form>
      <p className="links">
        <a href="/connect">Channels</a>
        <button className="back" type="button" onClick={() => signOut({ callbackUrl: "/login" })}>Log out</button>
      </p>
    </main>
  );
}
