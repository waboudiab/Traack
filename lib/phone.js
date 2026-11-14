export function normalizePhone(input) {
  if (!input) return "";
  const trimmed = String(input).trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return "";
}

export function extractPhone(text) {
  const match = String(text || "").match(
    /(\+\d[\d\s().-]{8,}\d)|(\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/
  );
  if (!match) return "";
  return normalizePhone(match[0]);
}

export function safeHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

export function oneLine(value, max = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function displayName(name, email, phone) {
  const cleaned = String(name || "").trim();
  if (cleaned && !cleaned.includes("@")) return cleaned.slice(0, 80);
  if (email && email.includes("@")) return email.split("@")[0];
  return phone || "Unknown";
}

export function firstName(name) {
  const token = String(name || "").trim().split(/\s+/)[0];
  if (!token || token === "Unknown") return "there";
  return token;
}
