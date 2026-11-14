export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL) return;
  const { startPollTimer } = await import("./lib/poll-timer");
  startPollTimer();
}
