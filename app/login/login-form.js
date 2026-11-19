"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const googleErrors = {
  need_shop: "Enter the shop name, then continue with Google.",
  no_shop: "No shop uses that Google account. Create one and enter the shop name.",
  google: "Google sign-in did not finish. Try again.",
};

export default function LoginForm({ googleEnabled, ticket, errorCode, startNew }) {
  const router = useRouter();
  const [creating, setCreating] = useState(startNew || errorCode === "need_shop" || errorCode === "no_shop");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(googleErrors[errorCode] || "");
  const [pending, setPending] = useState(Boolean(ticket));

  async function finish() {
    const me = await fetch("/api/me").then((res) => res.json()).catch(() => null);
    router.push(me?.emailConnected ? "/leads" : "/connect");
    router.refresh();
  }

  useEffect(() => {
    if (!ticket) return;
    let cancel = false;
    signIn("credentials", { ticket, redirect: false }).then(async (result) => {
      if (cancel) return;
      if (!result?.ok) {
        setPending(false);
        setError("Google sign-in did not finish. Try again.");
        return;
      }
      await finish();
    });
    return () => {
      cancel = true;
    };
  }, [ticket]);

  function continueGoogle() {
    setError("");
    const shopName = name.trim();
    if (creating && shopName.length < 2) {
      setError("Enter the shop name.");
      return;
    }
    const url = new URL("/api/auth/google", window.location.origin);
    if (creating) url.searchParams.set("name", shopName);
    window.location.assign(url.toString());
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (creating) {
        const created = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const payload = await created.json();
        if (!created.ok) {
          setError(payload.error || "Could not create the account.");
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result?.ok) {
        setError("Email or password is wrong.");
        return;
      }
      await finish();
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="screen">
      <p className="brand">Traack</p>
      <h2>{creating ? "Create account" : "Log in"}</h2>
      <p className="lead">
        {creating
          ? "$19.99 a month. The inbox connects next."
          : "Shop owner account. Channels connect next."}
      </p>
      {error ? <p className="error">{error}</p> : null}
      {creating ? (
        <label className="field">
          Shop name
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="organization" />
        </label>
      ) : null}
      {googleEnabled ? (
        <>
          <button className="secondary" type="button" disabled={pending} onClick={continueGoogle}>
            Continue with Google
          </button>
          <p className="hint">Signs you into Traack. The shop inbox connects on the next screen.</p>
          <p className="or">or</p>
        </>
      ) : null}
      <form onSubmit={onSubmit}>
        <label className="field">
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={creating ? "new-password" : "current-password"} />
        </label>
        <p className="hint">Separate from Connect inbox.</p>
        <button className="primary" type="submit" disabled={pending}>
          {pending ? "Working…" : "Continue"}
        </button>
      </form>
      <p className="links">
        <button className="back" type="button" onClick={() => { setCreating((value) => !value); setError(""); }}>
          {creating ? "Have an account? Log in" : "Create a shop account"}
        </button>
      </p>
    </main>
  );
}
