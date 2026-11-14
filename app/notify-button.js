"use client";

import { useEffect, useState } from "react";

function keyBytes(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export default function NotifyButton({ publicKey }) {
  const [state, setState] = useState("checking");
  const [error, setError] = useState("");

  async function subscribe() {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      });
    }
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!res.ok) throw new Error("save");
    setState("on");
  }

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (!publicKey || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState(ios && !standalone ? "ios-install" : "unsupported");
      return;
    }
    if (ios && !standalone) {
      setState("ios-install");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    if (Notification.permission === "granted") {
      subscribe().catch(() => setState("ready"));
      return;
    }
    setState("ready");
  }, [publicKey]);

  async function enable() {
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "ready");
        return;
      }
      await subscribe();
    } catch {
      setError("Notifications could not be turned on.");
      setState("ready");
    }
  }

  if (!publicKey || state === "checking" || state === "unsupported" || state === "on") return null;
  if (state === "ios-install") {
    return <p className="hint">On iPhone, add Traack to the Home Screen, open it from that icon, then turn notifications on.</p>;
  }
  if (state === "denied") {
    return <p className="hint">Notifications are blocked. Allow them for Traack in the phone’s app settings.</p>;
  }
  return (
    <>
      <button className="secondary" type="button" onClick={enable}>Turn on notifications</button>
      {error ? <p className="error">{error}</p> : null}
      <p className="hint">The phone alerts you when a new lead or a new customer message arrives, even if Traack is closed.</p>
    </>
  );
}
