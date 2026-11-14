"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function finish() {
    const me = await fetch("/api/me").then((res) => res.json()).catch(() => null);
    router.push(me?.emailConnected ? "/leads" : "/connect");
    router.refresh();
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
      <p className="lead">Shop owner account. Channels connect next.</p>
      {error ? <p className="error">{error}</p> : null}
      <form onSubmit={onSubmit}>
        {creating ? (
          <label className="field">
            Shop name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="organization" />
          </label>
        ) : null}
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
