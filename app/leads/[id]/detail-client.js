"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const statuses = ["new", "pending", "done", "declined"];
const labels = { new: "New", pending: "Pending", done: "Done", declined: "Declined" };

export default function DetailClient({ lead }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.status);
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [threadTrashed, setThreadTrashed] = useState(Boolean(lead.threadTrashed));
  const [trashedWhen, setTrashedWhen] = useState(lead.threadTrashedWhen || "");

  useEffect(() => {
    document.getElementById("latest-msg")?.scrollIntoView({ block: "center" });
  }, []);

  useEffect(() => {
    if (lead.threadTrashed) setThreadTrashed(true);
    if (lead.threadTrashedWhen) setTrashedWhen(lead.threadTrashedWhen);
  }, [lead.threadTrashed, lead.threadTrashedWhen]);

  async function choose(next) {
    setPending(true);
    setToast("");
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Could not update the lead.");
        return;
      }
      setStatus(data.status);
      router.refresh();
      if (data.leftQueue) {
        router.push(data.reviewQueued ? "/leads?sent=maps" : "/leads");
        return;
      }
      setToast(data.toast);
    } finally {
      setPending(false);
    }
  }

  async function trashThread() {
    setPending(true);
    setToast("");
    try {
      const res = await fetch(`/api/leads/${lead.id}/trash`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Could not move the thread to Trash.");
        return;
      }
      setThreadTrashed(true);
      setTrashedWhen((current) => current || "Just now");
      setConfirmTrash(false);
      setToast(data.toast);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function openEmail() {
    if (threadTrashed) {
      setToast("That thread is in Gmail Trash. The messages above stay in Traack.");
      return;
    }
    if (!lead.openUrl) {
      setToast("No email address on the latest customer message.");
      return;
    }
    if (lead.openUrl.startsWith("http")) {
      window.open(lead.openUrl, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href = lead.openUrl;
  }

  function openText() {
    if (!lead.phone) {
      setToast("No mobile number on this lead.");
      return;
    }
    setToast("Opening the text app for this customer.");
    window.location.href = `sms:${lead.phone}`;
  }

  return (
    <main className="screen">
      <button className="back" type="button" onClick={() => router.push("/leads")}>Back to leads</button>
      <p className="brand" style={{ marginTop: 10 }}>Lead #{lead.number}</p>
      <h2>{lead.name}</h2>
      <p className="lead">{lead.subjectLine}</p>
      {lead.aiNote ? <p className="hint">AI: {lead.aiNote}. Opening clears unread and focuses the latest customer message.</p> : null}

      <div className="card">
        <p className="person">From {lead.email || "—"}</p>
        <p className="person">Phone {lead.phone || "—"}</p>
        {threadTrashed ? (
          <p className="trashed-note">Email thread in Gmail Trash{trashedWhen ? ` · ${trashedWhen}` : ""}. The messages below stay in Traack.</p>
        ) : null}
        {lead.messages.map((message) => (
          <div key={message.id} id={message.latest ? "latest-msg" : undefined} className={message.latest ? "msg latest" : message.direction === "out" ? "msg out" : "msg"}>
            <div className="when">{message.when} · {message.latest ? "latest from customer" : message.label}</div>
            {message.body}
          </div>
        ))}
      </div>

      <h3>Status</h3>
      <div className="status-btns">
        {statuses.map((item) => (
          <button key={item} type="button" aria-pressed={status === item} disabled={pending} onClick={() => choose(item)}>
            {labels[item]}
          </button>
        ))}
      </div>

      <h3>Reply to customer</h3>
      <div className="row">
        <button className="secondary" type="button" disabled={threadTrashed} onClick={openEmail}>Open latest email</button>
        <button className="secondary" type="button" onClick={openText}>Open text</button>
      </div>
      <p className="hint">
        {threadTrashed
          ? "Open latest email is off because this thread is in Gmail Trash."
          : "Opens Mail or Messages on the newest customer message. No in-app compose in this version."}
      </p>

      {lead.canTrash && !threadTrashed ? (
        <div className="trash-block">
          {confirmTrash ? (
            <div className="confirm">
              <p>Move {lead.name}&apos;s email thread to Gmail Trash? This lead stays in Traack. You can restore it from Gmail Trash for about 30 days.</p>
              <div className="row">
                <button className="danger" type="button" disabled={pending} onClick={trashThread}>Move to Trash</button>
                <button className="secondary" type="button" disabled={pending} onClick={() => setConfirmTrash(false)}>Keep the thread</button>
              </div>
            </div>
          ) : (
            <>
              <button className="danger" type="button" disabled={pending} onClick={() => setConfirmTrash(true)}>Delete thread</button>
              <p className="hint">Moves the Gmail conversation to Trash. Traack keeps this lead.</p>
            </>
          )}
        </div>
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}
