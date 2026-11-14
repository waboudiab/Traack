export function shopTimeZone() {
  return process.env.SHOP_TIMEZONE || "America/Toronto";
}

export function zonedParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: shopTimeZone(),
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const bag = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return bag;
}

function dayIndex(date) {
  const parts = zonedParts(date);
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

export function relativeWhen(value, now = new Date()) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const days = Math.round((dayIndex(now) - dayIndex(date)) / 86400000);
  if (days <= 0) {
    const hours = Math.max(1, Math.floor(minutes / 60));
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: shopTimeZone(),
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatWhen(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = zonedParts(date);
  const now = zonedParts(new Date());
  const sameDay = parts.year === now.year && parts.month === now.month && parts.day === now.day;
  const clock = `${parts.hour}:${parts.minute}${String(parts.dayPeriod || "").toLowerCase()}`;
  return sameDay ? `Today ${clock}` : `${parts.weekday} ${clock}`;
}

export function hourInShop(date) {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: shopTimeZone(),
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  return Number(value || 0);
}

export function quietHoursActive(settings, now = new Date()) {
  if (!settings?.quietHours) return false;
  const hour = hourInShop(now);
  return hour >= 21 || hour < 8;
}

const NUDGE_MINUTES = [5, 10, 30, 60, 240, 1440, 2880, 4320];
const LEGACY_NUDGE_HOURS = { 4: 240, 24: 1440, 48: 2880, 72: 4320 };

export function nudgeMinutes(value) {
  const picked = Number(value);
  if (LEGACY_NUDGE_HOURS[picked]) return LEGACY_NUDGE_HOURS[picked];
  return NUDGE_MINUTES.includes(picked) ? picked : 1440;
}

export function nudgeMs(value) {
  return nudgeMinutes(value) * 60 * 1000;
}
