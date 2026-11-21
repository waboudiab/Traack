"use client";

import { useState } from "react";
import { PRESETS } from "@/lib/presets";

const presetOrder = ["generic", "hostinger", "doteasy", "gmail", "outlook"];

export default function ConnectForm({ shop, googleEnabled, googleRedirectUri, notice, saved }) {
  const connected = shop.emailConnect;
  const [openImap, setOpenImap] = useState(Boolean(connected?.type === "imap"));
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState(notice || "");
  const [message, setMessage] = useState(saved || "");
  const [pending, setPending] = useState("");
  const [phoneOn, setPhoneOn] = useState(Boolean(shop.phone?.twilioNumber));
  const [twilioNumber, setTwilioNumber] = useState(shop.phone?.twilioNumber || "");
  const [imap, setImap] = useState({
    email: connected?.username || "",
    password: "",
    preset: connected?.preset || "generic",
    imapHost: connected?.imapHost || "",
    imapPort: String(connected?.imapPort || 993),
    smtpHost: connected?.smtpHost || "",
    smtpPort: String(connected?.smtpPort || 465),
    tls: connected?.tls !== false,
  });
  const [ownerMobile, setOwnerMobile] = useState(shop.phone?.ownerMobile || shop.settings?.ownerMobile || "");
  const [callMode, setCallMode] = useState(shop.phone?.callMode || "both");

  function setPreset(preset) {
    const item = PRESETS[preset];
    setImap((current) => ({
      ...current,
      preset,
      imapHost: item.imapHost,
      imapPort: String(item.imapPort),
      smtpHost: item.smtpHost,
      smtpPort: String(item.smtpPort),
    }));
  }

  async function post(url, payload, key) {
    setError("");
    setMessage("");
    setPending(key);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "That did not work.");
        return null;
      }
      setMessage(data.message || "Saved.");
      return data;
    } finally {
      setPending("");
    }
  }

  async function testOrSave(mode) {
    const data = await post("/api/connect/imap", { ...imap, mode }, mode);
    if (data && mode === "save") setOpenImap(true);
  }

  async function connectPhone() {
    const data = await post("/api/connect/phone", { ownerMobile, callMode }, "phone");
    if (!data) return;
    setPhoneOn(true);
    setTwilioNumber(data.twilioNumber);
    setMessage(`Text and calls connected on ${data.twilioNumber}.`);
  }

  const emailConnected = Boolean(connected?.username);

  return (
    <main className="screen">
      <p className="brand">Traack</p>
      <h2>Connect channels</h2>
      <p className="lead">The business email clients already write to, plus a number for texts and calls.</p>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="toast">{message}</p> : null}

      <div className="card">
        <div className="switch-row">
          <span>Client query box</span>
          <span className={emailConnected ? "badge ok" : "badge"}>{emailConnected ? "Connected" : "Not connected"}</span>
        </div>
        {emailConnected ? <p className="hint">{connected.username} · {connected.type === "gmail" ? "Google" : "IMAP"}</p> : null}
        {googleEnabled ? (
          <>
            <a className="secondary" href="/api/connect/google">Connect with Google</a>
            <p className="hint" style={{ marginTop: 8 }}>
              In Google Cloud, Authorized redirect URI must be exactly {googleRedirectUri}
            </p>
          </>
        ) : (
          <button className="secondary" type="button" onClick={() => setError("Google OAuth is not configured. Use other email (IMAP).")}>
            Connect with Google
          </button>
        )}
        <div style={{ height: 8 }} />
        <button className="secondary" type="button" onClick={() => setOpenImap((value) => !value)}>
          Other email (IMAP)
        </button>
        {openImap ? (
          <div style={{ marginTop: 12 }}>
            <label className="field">
              Email address
              <input value={imap.email} placeholder="info@yourshop.com" onChange={(event) => setImap({ ...imap, email: event.target.value })} />
            </label>
            <label className="field">
              Password / app password
              <input type="password" value={imap.password} placeholder="Mailbox password" onChange={(event) => setImap({ ...imap, password: event.target.value })} />
            </label>
            <label className="field">
              Preset
              <select value={imap.preset} onChange={(event) => setPreset(event.target.value)}>
                {presetOrder.map((key) => (
                  <option key={key} value={key}>{PRESETS[key].label}</option>
                ))}
              </select>
            </label>
            <button className="back" type="button" onClick={() => setAdvanced((value) => !value)}>
              {advanced ? "Hide advanced" : "Advanced"}
            </button>
            {advanced ? (
              <div style={{ marginTop: 12 }}>
                <label className="field">
                  IMAP host
                  <input value={imap.imapHost} onChange={(event) => setImap({ ...imap, imapHost: event.target.value })} />
                </label>
                <label className="field">
                  IMAP port
                  <input value={imap.imapPort} onChange={(event) => setImap({ ...imap, imapPort: event.target.value })} />
                </label>
                <label className="field">
                  SMTP host
                  <input value={imap.smtpHost} onChange={(event) => setImap({ ...imap, smtpHost: event.target.value })} />
                </label>
                <label className="field">
                  SMTP port
                  <input value={imap.smtpPort} onChange={(event) => setImap({ ...imap, smtpPort: event.target.value })} />
                </label>
                <div className="switch-row">
                  <span>TLS</span>
                  <input type="checkbox" checked={imap.tls} onChange={(event) => setImap({ ...imap, tls: event.target.checked })} />
                </div>
              </div>
            ) : null}
            <p className="hint">Works with Hostinger, Doteasy, and most hosts. Google/Microsoft: use app password or Connect Google.</p>
            <div className="row">
              <button className="secondary" type="button" disabled={pending === "test"} onClick={() => testOrSave("test")}>
                {pending === "test" ? "Testing…" : "Test connection"}
              </button>
              <button className="secondary" type="button" disabled={pending === "save"} onClick={() => testOrSave("save")}>
                {pending === "save" ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="switch-row">
          <span>Text & calls</span>
          <span className={phoneOn ? "badge ok" : "badge"}>{phoneOn ? `Connected ${twilioNumber}` : "Off"}</span>
        </div>
        <p className="hint">Twilio number for customer SMS, owner alerts, and inbound calls.</p>
        <label className="field">
          Owner mobile (forward)
          <input value={ownerMobile} onChange={(event) => setOwnerMobile(event.target.value)} placeholder="+1 416 555 0144" />
        </label>
        <label className="field">
          Call mode
          <select value={callMode} onChange={(event) => setCallMode(event.target.value)}>
            <option value="both">Both: forward + missed-call text</option>
            <option value="forward">Forward to me</option>
            <option value="miss_sms">Missed-call text only</option>
          </select>
        </label>
        <p className="hint">Inbound calls ring your mobile. Missed calls can get an automatic text.</p>
        <button className="secondary" type="button" disabled={pending === "phone"} onClick={connectPhone}>
          {pending === "phone" ? "Connecting…" : "Connect text & calls"}
        </button>
      </div>

      <a className="primary" href="/settings">Continue to settings</a>
    </main>
  );
}
