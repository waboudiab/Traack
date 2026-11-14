import { dispatchShopJobs } from "@/lib/cron";
import { assertCron, json } from "@/lib/http";
import { getDb } from "@/lib/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req) {
  if (!assertCron(req)) return json({ error: "Unauthorized" }, 401);
  const db = await getDb();
  const shops = await db.collection("shops").find({}, { projection: { _id: 1 } }).toArray();
  return dispatchShopJobs(req, shops, (id) => `/api/cron/nudge/${id}`);
}

export function GET(req) {
  return run(req);
}

export function POST(req) {
  return run(req);
}
