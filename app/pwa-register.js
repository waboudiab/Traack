"use client";

import { useEffect } from "react";

function sameAppPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

export default function PwaRegister() {
  useEffect(() => {
    const open = sameAppPath(new URLSearchParams(window.location.search).get("open") || "");
    if (open) {
      window.location.replace(open);
      return;
    }
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event) => {
      if (event.data?.type !== "traack-open") return;
      const path = sameAppPath(event.data.url);
      if (!path) return;
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (path !== here) window.location.assign(path);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  return null;
}
