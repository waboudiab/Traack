import crypto from "crypto";

const STATUSES = ["new", "pending", "done", "declined"];

function secret() {
  return String(process.env.NEXTAUTH_SECRET || "");
}

export function statusLink(origin, { leadId, status, days = 7 }) {
  const body = Buffer.from(
    JSON.stringify({
      leadId: String(leadId),
      status,
      exp: Date.now() + days * 24 * 60 * 60 * 1000,
    })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${String(origin || "").replace(/\/$/, "")}/api/leads/status?t=${body}.${sig}`;
}

export function readStatusToken(token) {
  if (!secret()) return null;
  const raw = String(token || "");
  const cut = raw.lastIndexOf(".");
  if (cut <= 0) return null;
  const body = raw.slice(0, cut);
  const sig = raw.slice(cut + 1);
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data?.leadId || !STATUSES.includes(data.status) || !data.exp || data.exp < Date.now()) return null;
  return data;
}
