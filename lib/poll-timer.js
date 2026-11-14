const INTERVAL_MS = 30 * 1000;

function checkInboxes() {
  const origin = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const headers = {};
  if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
  fetch(`${origin}/api/cron/poll`, { headers }).catch((error) => {
    console.error("inbox check", error);
  });
}

export function startPollTimer() {
  const state = globalThis;
  if (state.__quotedeskPollTimer) return;
  console.log("Inbox check every 30 seconds");
  state.__quotedeskPollTimer = setInterval(checkInboxes, INTERVAL_MS);
  setTimeout(checkInboxes, 5000);
}
