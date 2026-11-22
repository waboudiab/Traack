"use client";

export default function BillingBanner({ message }) {
  if (!message) return null;
  return (
    <a className="billing-banner" href="/settings#billing">
      {message}
    </a>
  );
}
