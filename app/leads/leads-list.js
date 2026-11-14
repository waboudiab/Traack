"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const filters = [
  ["hot", "Hot"],
  ["new", "New"],
  ["pending", "Pending"],
  ["done", "Done"],
  ["all", "All"],
];

function badgeFor(lead) {
  if (lead.status === "done") return ["ok", "Done"];
  if (lead.status === "declined") return ["declined", "Declined"];
  if (lead.status === "pending") return ["pending", "Pending"];
  return ["new", "New"];
}

export default function LeadsList({ leads, notice }) {
  const [filter, setFilter] = useState("hot");
  const [sort, setSort] = useState("newest");

  const visible = useMemo(() => {
    const rows = leads.filter((lead) => {
      if (filter === "all") return lead.status !== "done";
      if (filter === "hot") return lead.hot && (lead.status === "new" || lead.status === "pending");
      return lead.status === filter;
    });
    const rank = { new: 0, pending: 1, done: 2, declined: 3 };
    rows.sort((a, b) => {
      if (sort === "status") {
        const byStatus = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        if (byStatus) return byStatus;
      }
      const aTime = a.lastCustomerAt || "";
      const bTime = b.lastCustomerAt || "";
      return sort === "oldest" ? aTime.localeCompare(bTime) : bTime.localeCompare(aTime);
    });
    return rows;
  }, [leads, filter, sort]);

  return (
    <main className="screen">
      <div className="top">
        <div>
          <p className="brand" style={{ margin: 0 }}>Leads</p>
          <h2 style={{ fontSize: 22, margin: "4px 0 0" }}>Hot queue</h2>
        </div>
        <Link className="back" href="/settings">Settings</Link>
      </div>
      <div className="filters">
        {filters.map(([key, label]) => (
          <button key={key} type="button" className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>
      {notice ? <div className="toast" role="status">{notice}</div> : null}
      <label className="field">
        Sort
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="status">Status</option>
        </select>
      </label>
      {leads.length === 0 ? (
        <p className="lead">No leads yet. Send a quote email to your connected inbox, or wait for a customer.</p>
      ) : null}
      {leads.length > 0 && visible.length === 0 ? <p className="lead">Nothing in this filter.</p> : null}
      {visible.map((lead) => {
        const [badgeClass, badgeLabel] = badgeFor(lead);
        const activity = lead.status === "done" && lead.reviewSent
          ? "Review link sent · no new messages"
          : lead.snippet;
        return (
          <Link key={lead.id} href={`/leads/${lead.id}`} className={lead.unreadCount > 0 ? "lead-row has-unread" : "lead-row"}>
            <div className="meta">
              <span>#{lead.number} · {lead.channel}{lead.ago ? ` · ${lead.ago}` : ""}</span>
              <span className="badges">
                {lead.hot && (lead.status === "new" || lead.status === "pending") ? <span className="badge hot">Hot</span> : null}
                <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
              </span>
            </div>
            <div className="name-row">
              <span className="name">{lead.name}</span>
              {lead.unreadCount > 0 ? <span className="dot">{lead.unreadCount}</span> : null}
            </div>
            <div className="snip">
              {lead.unreadCount > 0 ? <><strong>New:</strong> “{lead.snippet}”</> : activity}
            </div>
            {lead.replySent || lead.reminderSent || lead.reviewSent ? (
              <div className="checks">
                {lead.replySent ? <span className="check">✓ Reply</span> : null}
                {lead.reminderSent ? <span className="check">✓ Reminder</span> : null}
                {lead.reviewSent ? <span className="check">✓ Review</span> : null}
              </div>
            ) : null}
            {lead.threadTrashed ? <div className="snip">Email thread in Gmail Trash</div> : null}
          </Link>
        );
      })}
    </main>
  );
}
