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

function phoneKind() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  return { ios, standalone };
}

export default function NotifyButton({ publicKey }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState("Alerts this phone when a new lead or a new customer message arrives.");

  async function saveSubscription() {
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
  }

  async function clearSubscription() {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    const endpoint = subscription?.endpoint || "";
    if (subscription) await subscription.unsubscribe();
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
  }

  useEffect(() => {
    let cancel = false;
    const hint = "Alerts this phone when a new lead or a new customer message arrives.";
    async function load() {
      const { ios, standalone } = phoneKind();
      if (ios && !standalone) {
        if (!cancel) {
          setBusy(false);
          setNote("On iPhone, add Traack to the Home Screen and open it from that icon.");
        }
        return;
      }
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancel) {
          setBusy(false);
          setNote("This phone cannot show Traack alerts.");
        }
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancel) {
          setBusy(false);
          setOn(false);
          setNote("Notifications are blocked. Allow them for Traack in the phone’s settings, then turn this on.");
        }
        return;
      }
      if (Notification.permission === "granted" && publicKey) {
        try {
          await saveSubscription();
          if (!cancel) {
            setOn(true);
            setNote(hint);
          }
        } catch {
          if (!cancel) setNote("Notifications could not be turned on.");
        }
      }
      if (!cancel) setBusy(false);
    }
    load();
    return () => {
      cancel = true;
    };
  }, [publicKey]);

  async function onToggle(event) {
    const next = event.target.checked;
    const hint = "Alerts this phone when a new lead or a new customer message arrives.";
    const { ios, standalone } = phoneKind();
    if (ios && !standalone) return;
    if (!next) {
      setOn(false);
      setNote(hint);
      try {
        await clearSubscription();
      } catch {
        setNote("This phone could not be turned off. Try again.");
      }
      return;
    }
    if (!publicKey) {
      setOn(false);
      setNote("Notifications are not ready on the server yet.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setOn(false);
        setNote(
          permission === "denied"
            ? "Notifications are blocked. Allow them for Traack in the phone’s settings, then turn this on."
            : hint
        );
        return;
      }
      await saveSubscription();
      setOn(true);
      setNote(hint);
    } catch {
      setOn(false);
      setNote("Notifications could not be turned on.");
    } finally {
      setBusy(false);
    }
  }

  const blocked = note.startsWith("On iPhone") || note.startsWith("This phone cannot");

  return (
    <>
      <div className="switch-row">
        <span>Notify on this phone</span>
        <input type="checkbox" checked={on} disabled={busy || blocked} onChange={onToggle} />
      </div>
      <p className="hint">{note}</p>
    </>
  );
}
