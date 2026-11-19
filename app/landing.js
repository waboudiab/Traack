"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_EMAIL_TEMPLATE } from "@/lib/presets";

const START = "/login?new=1";

export default function Landing() {
  const [mode, setMode] = useState("");
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (standalone) {
      setMode("installed");
      return;
    }
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setMode("ios");
    function onPrompt(event) {
      event.preventDefault();
      setPrompt(event);
      setMode("install");
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    setPrompt(null);
    if (choice?.outcome === "accepted") setMode("installed");
  }

  return (
    <div className="land">
      <header className="land-nav">
        <div className="land-wrap land-nav-inner">
          <Link className="land-logo" href="/">Traack</Link>
          <nav className="land-nav-links" aria-label="Page">
            <a className="land-anchor" href="#inbox">Inbox</a>
            <a className="land-anchor" href="#reply">Replies</a>
            <a className="land-anchor" href="#reviews">Reviews</a>
            <a className="land-anchor" href="#price">Price</a>
            <Link className="land-login" href="/login">Log in</Link>
            <Link className="land-btn land-btn-small" href={START}>Start free month</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="land-hero">
          <div className="land-wrap land-hero-grid">
            <div>
              <p className="brand">For shops that live in their inbox</p>
              <h1>Keep the lead. Make more money.</h1>
              <p className="land-dek">
                You keep the shop email customers already use. Traack connects to it. A new estimate shows up on your phone,{" "}
                <mark className="land-mark">your customer gets your reply in minutes</mark>, and a finished job{" "}
                <mark className="land-mark">asks for the Google review</mark> that brings the next customer.
              </p>
              <div className="land-actions">
                <Link className="land-btn" href={START}>Start the free month</Link>
                {prompt ? (
                  <button className="land-btn-ghost" type="button" onClick={install}>Install Traack</button>
                ) : (
                  <a className="land-btn-ghost" href="#get-app">Add it to your phone</a>
                )}
              </div>
              <p className="land-price-line">First month free, no strings. Then $19.99 a month, flat.</p>
            </div>
            <QueuePhone />
          </div>
        </section>

        <section className="land-section" aria-labelledby="money-title">
          <div className="land-wrap">
            <h2 id="money-title">A watched lead is a job you can still win</h2>
            <p className="land-dek land-dek-narrow">
              Maya writes three shops about a cracked bumper. The shop that answers first, while she is still looking at her phone, is the one she books. Traack is that answer, connected to the shop email you already own.
            </p>
            <div className="land-points">
              <article className="land-point">
                <p className="land-num">01</p>
                <h3>Retain the lead</h3>
                <p>The request leaves the pile of mail and lands in a hot queue. <strong>Your reply goes out from your own address the same minute.</strong></p>
                <StatusTap pressed="new" label="It arrives as New. You have not tapped anything yet." />
              </article>
              <article className="land-point">
                <p className="land-num">02</p>
                <h3>Stay on it</h3>
                <p>The lead stays on your phone while you work it. <strong>You set the interval. When it passes with no answer from you, Traack nudges you.</strong></p>
                <StatusTap pressed="pending" label="You tap Pending to keep it open, or Declined to stop the nudges." />
              </article>
              <article className="land-point land-point-key">
                <p className="land-num">03</p>
                <h3>Get the next one</h3>
                <p><strong>You tap Done and Traack sends your Google Maps link.</strong> A fresh review is how the next stranger finds you.</p>
                <StatusTap pressed="done" label="You tap Done. The Maps link goes out and the lead leaves the queue." />
              </article>
            </div>
          </div>
        </section>

        <section className="land-band" id="inbox" aria-labelledby="inbox-title">
          <div className="land-wrap land-split">
            <div>
              <p className="brand">Your email</p>
              <h2 id="inbox-title">You keep your shop email. Traack connects to it.</h2>
              <p className="land-callout">That mailbox stays yours. Customers already write to it. Traack connects to it.</p>
              <p className="land-dek">
                Connect Google, or the mailbox on your own domain. New estimates from that inbox show on your phone, and replies go out from the same shop email.
              </p>
              <ol className="land-steps">
                <li>Connect the email you already own. Google is one step. Hostinger, Outlook, Gmail, Doteasy, and other IMAP mailboxes use the address and password.</li>
                <li>Estimates sent to that shop email show on your phone.</li>
              </ol>
              <div className="land-chips" aria-label="Inboxes Traack can link">
                <span>Google</span>
                <span>Gmail</span>
                <span>Outlook</span>
                <span>Hostinger</span>
                <span>Doteasy</span>
                <span>Any IMAP</span>
              </div>
            </div>
            <div className="land-panel" aria-hidden="true">
              <p className="brand">Connect</p>
              <h3 className="land-panel-title">Client query box</h3>
              <div className="card">
                <div className="switch-row">
                  <span>info@northsideauto.com</span>
                  <span className="badge ok">Connected</span>
                </div>
                <p className="hint">The shop email clients already write their queries to</p>
              </div>
              <div className="stack">
                <span className="secondary land-fake-btn">Connect with Google</span>
                <span className="secondary land-fake-btn">Other email (IMAP)</span>
              </div>
              <p className="hint">Sample. Your shop name and mailbox go here after you start.</p>
            </div>
          </div>
        </section>

        <section className="land-section" id="reply" aria-labelledby="reply-title">
          <div className="land-wrap">
            <p className="brand">Custom reply</p>
            <h2 id="reply-title">They hear from you before they call the next shop</h2>
            <p className="land-callout">You write the reply once. Traack sends it in minutes from your business email.</p>
            <p className="land-dek land-dek-narrow">
              Traack fills in the customer’s name, the subject, and your shop name. That quick note is what keeps the lead.
            </p>
            <div className="land-split">
              <div className="land-thread">
                <p className="land-sample">Sample · Northside Auto</p>
                <article className="land-mail">
                  <div className="land-mail-top">
                    <span className="badge new">Customer</span>
                    <span>9:14 am</span>
                  </div>
                  <p className="land-mail-who">Maya Chen · Front bumper repair</p>
                  <p>Hi, the front bumper on my Civic is cracked. Can you quote a repair this week? I can drop it off Thursday.</p>
                </article>
                <article className="land-mail land-mail-sent">
                  <div className="land-mail-top">
                    <span className="badge ok">Sent from your inbox</span>
                    <span>9:14 am</span>
                  </div>
                  <p className="land-mail-who">To Maya · info@northsideauto.com</p>
                  <p>Hi Maya, we got your estimate request about “front bumper repair”. We’ll review and reply shortly. — Northside Auto</p>
                </article>
                <p className="land-callout">You set the interval. When it passes and you still have not answered, Traack nudges you.</p>
                <p className="hint">By text, by email, and on your phone. Choose 5 minutes, 1 hour, 1 day, or up to 3 days. The automatic hello does not count. A new message from the customer starts the interval again. From 9pm to 8am the nudge waits.</p>
                <div className="land-chips" aria-label="Reminder intervals">
                  <span>5 minutes</span>
                  <span>1 hour</span>
                  <span className="land-chip-on">1 day</span>
                  <span>3 days</span>
                </div>
                <article className="land-mail">
                  <div className="land-mail-top">
                    <span className="badge hot">Nudge to you</span>
                    <span>Next day</span>
                  </div>
                  <p className="land-mail-who">Text, email, and phone</p>
                  <p>Traack: lead #104 from Maya Chen still has no shop reply.</p>
                </article>
              </div>
              <div className="land-panel">
                <p className="brand">Settings</p>
                <h3 className="land-panel-title">First-response template</h3>
                <label className="field">
                  Email template
                  <textarea readOnly value={DEFAULT_EMAIL_TEMPLATE} />
                </label>
                <p className="hint">{"Change the words any time. Vars: {{first_name}} {{subject}} {{shop_name}}"}</p>
                <div className="card">
                  <p className="person">What Maya receives</p>
                  <p className="land-quote">Hi Maya, we got your estimate request about “front bumper repair”. We’ll review and reply shortly. — Northside Auto</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="land-band" id="reviews" aria-labelledby="reviews-title">
          <div className="land-wrap land-split">
            <div>
              <p className="brand">Google reviews</p>
              <h2 id="reviews-title">Reviews are how the next customer finds you</h2>
              <p className="land-callout">Traack sends your Maps link when you mark the lead Done.</p>
              <p className="land-dek">
                People search the job, then look at the listing. The star rating, the words, and how recent those reviews are decide whether they tap your number. <mark className="land-mark">A shop that keeps collecting new reviews gets more of those calls.</mark> That traffic comes from Google, and the cost is asking at the right moment.
              </p>
              <p className="land-dek">
                The link goes from the same business email, while the work is still fresh. You paste it once in settings. Declined jobs are left alone.
              </p>
              <div className="land-review-sample">
                <p className="land-sample">Sample review a finished job can earn</p>
                <p className="land-quote">Bumper was ready Thursday, and the price was what they said. Easy to deal with.</p>
                <p className="hint">Maya C. · Google review</p>
              </div>
            </div>
            <div className="land-panel" aria-hidden="true">
              <p className="brand">Lead #104</p>
              <h3 className="land-panel-title">Maya Chen</h3>
              <p className="hint">email · front bumper repair</p>
              <h3>Status</h3>
              <div className="status-btns">
                <button type="button" tabIndex={-1}>New</button>
                <button type="button" tabIndex={-1}>Pending</button>
                <button type="button" tabIndex={-1} aria-pressed="true">Done</button>
                <button type="button" tabIndex={-1}>Declined</button>
              </div>
              <div className="toast">Google Maps link sent. This lead left the queue.</div>
              <div className="msg latest">
                <div className="when">Just now · sent from your inbox</div>
                Thanks Maya. Here is our Google Maps link: maps.app.goo.gl/your-shop
              </div>
              <div className="checks">
                <span className="check">✓ Reply</span>
                <span className="check">✓ Review</span>
              </div>
            </div>
          </div>
        </section>

        <section className="land-section" id="price" aria-labelledby="price-title">
          <div className="land-wrap land-price-layout">
            <div>
              <p className="brand">Price</p>
              <h2 id="price-title">One month free. Then one flat price.</h2>
              <p className="land-dek">
                Use it on real customer mail before you pay anything. After the free month, Traack is $19.99 a month. Same price every month. The return is the lead you kept and the review that brought the next job.
              </p>
            </div>
            <div className="land-price-card">
              <p className="land-price-kicker">First month</p>
              <p className="land-price-figure">$0</p>
              <p className="land-price-then">Then <strong>$19.99</strong> / month</p>
              <ul>
                <li>Connects to the shop email you already own</li>
                <li>Hot queue on your phone</li>
                <li>Your custom first reply</li>
                <li>A nudge on the interval you set, when the lead is still unanswered</li>
                <li className="land-key">Google Maps link when you mark the job Done</li>
              </ul>
              <Link className="land-btn" href={START}>Start the free month</Link>
              <p className="hint">No card to start. No setup fee. No contract. Stop before the paid month and that is the end of it.</p>
            </div>
          </div>
        </section>

        <section className="land-band" id="get-app" aria-labelledby="install-title">
          <div className="land-wrap">
            <p className="brand">The app</p>
            <h2 id="install-title">Add Traack to your home screen</h2>
            <p className="land-dek land-dek-narrow">
              Traack installs from this page onto your home screen. It opens full screen, and the hot queue is the first thing you see.
            </p>
            <div className="land-install-grid">
              <article className="land-point">
                <h3>{prompt || mode === "installed" ? "On this phone" : "Install it where you work"}</h3>
                {mode === "installed" ? (
                  <p>Traack is already on this phone. Create the shop and the hot queue opens from the icon.</p>
                ) : prompt ? (
                  <p>Tap Install. The icon opens Traack full screen, on the hot queue.</p>
                ) : mode === "ios" ? (
                  <p>This is an iPhone. Use the Share steps in the next card.</p>
                ) : (
                  <p>Open this page on the phone you carry. Chrome shows Install. iPhone uses Safari’s Share menu.</p>
                )}
                {prompt ? (
                  <button className="land-btn" type="button" onClick={install}>Install Traack</button>
                ) : mode === "installed" ? (
                  <Link className="land-btn" href={START}>Start the free month</Link>
                ) : null}
              </article>
              <article className="land-point">
                <h3>iPhone</h3>
                <ol className="land-steps">
                  <li>Open this page in Safari.</li>
                  <li>Tap Share.</li>
                  <li>Tap Add to Home Screen, then Add.</li>
                </ol>
              </article>
              <article className="land-point">
                <h3>Android</h3>
                <ol className="land-steps">
                  <li>Open this page in Chrome.</li>
                  <li>Tap Install Traack when it appears.</li>
                  <li>Or open the browser menu and choose Install app.</li>
                </ol>
              </article>
            </div>
          </div>
        </section>

        <section className="land-close">
          <div className="land-wrap">
            <h2>Your next lead is already in the inbox.</h2>
            <p className="land-dek">Answer it in minutes. <mark className="land-mark">Ask for the review when the job is Done.</mark> Keep the work that would have gone quiet.</p>
            <Link className="land-btn" href={START}>Start the free month</Link>
          </div>
        </section>
      </main>

      <footer className="land-foot">
        <div className="land-wrap land-foot-inner">
          <span className="land-logo">Traack</span>
          <p>First month free, then $19.99 a month.</p>
          <Link href="/login">Log in</Link>
        </div>
      </footer>
    </div>
  );
}

function StatusTap({ pressed, label }) {
  const items = [
    ["new", "New"],
    ["pending", "Pending"],
    ["done", "Done"],
    ["declined", "Declined"],
  ];
  return (
    <div className="land-status" aria-hidden="true">
      <p className="land-tap">{label}</p>
      <div className="status-btns">
        {items.map(([key, name]) => (
          <button key={key} type="button" tabIndex={-1} aria-pressed={pressed === key}>{name}</button>
        ))}
      </div>
    </div>
  );
}

function QueuePhone() {
  return (
    <figure className="land-figure">
      <div className="land-phone" aria-hidden="true">
        <div className="land-phone-bar"><span /></div>
        <div className="land-phone-screen">
          <div className="top">
            <div>
              <p className="brand" style={{ margin: 0 }}>Leads</p>
              <h2>Hot queue</h2>
            </div>
            <span className="back">Settings</span>
          </div>
          <div className="filters">
            <button type="button" className="chip" aria-pressed="true" tabIndex={-1}>Hot</button>
            <button type="button" className="chip" tabIndex={-1}>New</button>
            <button type="button" className="chip" tabIndex={-1}>Pending</button>
            <button type="button" className="chip" tabIndex={-1}>Done</button>
            <button type="button" className="chip" tabIndex={-1}>All</button>
          </div>
          <div className="lead-row has-unread">
            <div className="meta">
              <span>#104 · email · 12m</span>
              <span className="badges">
                <span className="badge hot">Hot</span>
                <span className="badge new">New</span>
              </span>
            </div>
            <div className="name-row">
              <span className="name">Maya Chen</span>
              <span className="dot">1</span>
            </div>
            <div className="snip"><strong>New:</strong> “Can you quote a bumper repair this week?”</div>
            <div className="checks"><span className="check">✓ Reply</span></div>
          </div>
          <div className="lead-row">
            <div className="meta">
              <span>#103 · email · 2h</span>
              <span className="badge pending">Pending</span>
            </div>
            <div className="name-row"><span className="name">James Ortiz</span></div>
            <div className="snip">Rear door dent — can you look Friday?</div>
          </div>
          <div className="lead-row">
            <div className="meta">
              <span>#101 · email · 1d</span>
              <span className="badge ok">Done</span>
            </div>
            <div className="name-row"><span className="name">Priya Shah</span></div>
            <div className="snip">Review link sent · no new messages</div>
            <div className="checks">
              <span className="check">✓ Reply</span>
              <span className="check">✓ Review</span>
            </div>
          </div>
        </div>
      </div>
      <figcaption>Sample hot queue for Northside Auto.</figcaption>
    </figure>
  );
}
