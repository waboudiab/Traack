export const REQUIRED_ENV = [
  "MONGODB_URI",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "TOKEN_ENCRYPTION_KEY",
  "CRON_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "SHOP_TIMEZONE",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
];

export const OPTIONAL_ENV = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "OPENAI_API_KEY",
];

function envValue(name) {
  const read = new Function("name", "return process.env[name]");
  return String(read(name) || "").trim().replace(/^["']|["']$/g, "");
}

export function envReport({ production = false } = {}) {
  const missing = [];
  const present = [];
  for (const name of REQUIRED_ENV) {
    if (envValue(name)) present.push(name);
    else missing.push(name);
  }
  const optional = OPTIONAL_ENV.map((name) => ({ name, set: Boolean(envValue(name)) }));
  const problems = [];
  if (production) {
    for (const name of ["NEXTAUTH_URL", "GOOGLE_REDIRECT_URI"]) {
      const value = envValue(name);
      if (value.includes("localhost")) problems.push(`${name} still points at localhost`);
    }
  }
  return { ok: missing.length === 0 && problems.length === 0, missing, present, optional, problems };
}
