# Quote Desk — UI handoff (for implementer / “new agent”)

Use this doc + [`quote-desk-ui-prototype.html`](./quote-desk-ui-prototype.html) as the design source of truth.  
Open the HTML in a browser (double-click or Live Server). There is no Figma file; the prototype is the visual reference. You can screenshot frames into Figma later if needed.

**Product:** Quote Desk (working names: QuoteAck / InboxAck / ShopQ)  
**Stack context:** Next.js PWA + Mongo + Vercel + IMAP/SMTP + Twilio  
**POC plan:** [`quote-desk-poc-plan.md`](./quote-desk-poc-plan.md)

---

## Design tokens

| Token | Light | Notes |
|-------|--------|--------|
| `--bg` | `#efebe4` | App chrome / phone shell |
| `--surface` | `#ffffff` | Screen background |
| `--ink` | `#1c1917` | Primary text |
| `--muted` | `#57534e` | Secondary text |
| `--line` | `#e7e5e4` | Borders |
| `--accent` | `#0f766e` | Primary actions / brand |
| `--accent-ink` | `#ffffff` | Text on accent |
| `--hot` | `#b45309` | Hot / urgent badge |
| `--ok` | `#047857` | Done / connected |

- Font: system UI (`Segoe UI`, `Helvetica Neue`, sans-serif)
- Radius: 10–12px controls, 28px phone shell
- Mobile-first width ~390px; desktop can widen dashboard later
- No purple gradients, no emoji icons
- **PWA is required.** The owner installs Quote Desk from the phone browser onto the home screen. `display: standalone`. Theme `#0f766e`, background `#efebe4`. Start at `/`. The last opened shell can load offline; live leads still need the network. Not a native store app.

---

## Information architecture

```
/login
/connect          ← email (IMAP / Google) + phone (Twilio)
/settings         ← nudge, review URL, templates, quiet hours, owner mobile
/leads            ← list + filters + unread badges
/leads/[id]       ← detail, status, open latest email/SMS
```

Optional later: `/billing`, `/onboarding`.

---

## Screen 1 — Log in

**Purpose:** Shop owner account (not mailbox OAuth).

**UI**
- Brand: `Quote Desk`
- Title: `Log in`
- Fields: Email, Password
- Primary: `Continue` → `/connect` (first time) or `/leads`
- Hint: “Separate from Connect inbox.”

---

## Screen 2 — Connect channels

**Purpose:** Wire estimate inbox + phone.

### Block A — Estimate inbox (required)
- Status badge: Connected / Not connected
- Actions:
  - **Connect with Google** (OAuth) — for Gmail/Workspace
  - **Connect with Microsoft** (optional in POC; can hide)
  - **Other email (IMAP)** — expands form:
    - Email address
    - Password (or app password)
    - Preset select: Generic / Hostinger / Doteasy / Gmail IMAP / Outlook IMAP
    - Advanced (collapsed): IMAP host, port, SMTP host, port, TLS
    - `Test connection` then `Save`
- Hint: Google/Microsoft may need app password if not using OAuth.

### Block B — Phone (required for full POC)
- Status badge: Off / Connected `+1…`
- Fields / actions:
  - `Connect text & calls` → assigns/shows Twilio number
  - Owner mobile (forward target)
  - Call mode: `Forward to me` | `Missed-call text` | `Both`
- Hint: Customer SMS + missed calls land here; owner alerts use this number or owner mobile.

**Primary:** `Continue to settings`

---

## Screen 3 — Settings

**Purpose:** Behavior defaults.

| Section | Controls |
|---------|----------|
| Owner notify if quiet | Duration select (4h / **1 day** default / 2d / 3d); Notify by text; Notify by email |
| Google review | Paste Maps review URL or Place review link |
| First-response templates | Email textarea; SMS textarea; vars `{{first_name}}` `{{subject}}` `{{shop_name}}` |
| Other | Auto-ack new quotes only; Quiet hours; Owner mobile |

**Primary:** `Save settings` → `/leads`

---

## Screen 4 — Leads dashboard

**Purpose:** Hot queue of quote leads.

**Top bar:** title `Hot queue` + link to Settings

**Filters (chips, single-select):** Hot | New | Pending | Done | All  

**Sort:** Newest first | Oldest first | Status

**Lead row**
- Left meta: `#104 · email|sms|call`
- Badge: Hot / New / Pending / Done / Declined
- Name + **unread pill** (count) if new customer message since last open
- Snippet: if unread, bold prefix `New:` + latest customer line; else last activity
- Unread rows: slight accent border/background
- Click → `/leads/[id]` (clears unread; focus latest customer message)

**Empty:** “No leads yet. Connect inbox and wait for a quote email/text.”

---

## Screen 5 — Lead detail

**Purpose:** Act on one lead.

**Header:** Back | `Lead #104` | Customer name | channel · received time  
**AI line:** e.g. “new quote (photos + estimate ask)” or “existing job update”

**Card:** From, phone, message thread  
- Older messages muted  
- **Latest customer message** highlighted (accent bar); scroll into view on open

**Status (2×2 buttons, one pressed):** New | Pending | Done | Declined  
- Done → queue Google review to customer  
- Declined → stop nudges; no review  
- Pending → keep owner reminder interval  
- Same as SMS codes `104D` / `104X` / `104P`

**Reply actions**
- `Open latest email` → Gmail/Mail deep link or `mailto:` on latest message  
- `Open text` → `sms:+1…`  
POC does **not** require in-app compose.

---

## Behaviors the UI must support

1. Unread badge on list when customer sends a new message on an existing lead.  
2. Opening lead clears badge and jumps to latest customer message.  
3. “Open latest email/text” always targets the **newest customer** message, not the first.  
4. Connect IMAP works without Google (any host + password/app password).  
5. Phone block is first-class (not buried).

---

## Copy cheat sheet

| Place | Copy |
|-------|------|
| Connect IMAP | “Works with Hostinger, Doteasy, and most hosts. Google/Microsoft: use app password or Connect Google.” |
| Quiet notify | “Fires when the shop still has not replied to the customer after a new lead.” |
| Review field | “Used only when status is Done.” |
| Call forward | “Inbound calls ring your mobile. Missed calls can get an automatic text.” |

---

## Prototype map

File: `docs/quote-desk-ui-prototype.html`  
Tabs: Log in → Connect → Settings → Leads → Lead detail  

Implement Next.js routes to match these screens visually and behaviorally. Prefer this HTML over older chat visualizations if they conflict.
