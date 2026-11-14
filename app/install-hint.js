"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/brand";

const HIDE_KEY = "traack-install-hide";

export default function InstallHint() {
  const [mode, setMode] = useState("");
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (standalone || sessionStorage.getItem(HIDE_KEY)) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) setMode("ios");
    function onPrompt(event) {
      event.preventDefault();
      setPrompt(event);
      setMode("install");
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function hide() {
    sessionStorage.setItem(HIDE_KEY, "1");
    setMode("");
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice.catch(() => null);
    setPrompt(null);
    hide();
  }

  if (!mode) return null;

  return (
    <div className="install-bar" role="region" aria-label={`Install ${APP_NAME}`}>
      <p>{mode === "ios" ? `Add ${APP_NAME} from the Share button, then Add to Home Screen.` : `Install ${APP_NAME} on this phone.`}</p>
      <div className="install-actions">
        {mode === "install" ? (
          <button className="primary" type="button" onClick={install}>Install</button>
        ) : null}
        <button className="back" type="button" onClick={hide}>Not now</button>
      </div>
    </div>
  );
}
