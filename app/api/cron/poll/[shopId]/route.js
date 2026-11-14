import { ObjectId } from "mongodb";
import { claimShopJob, releaseShopJob } from "@/lib/cron";
import { assertCron, json } from "@/lib/http";
import { getDb } from "@/lib/mongo";
import { pollShop } from "@/lib/poll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req, shopId) {
  if (!assertCron(req)) return json({ error: "Unauthorized" }, 401);
  if (!ObjectId.isValid(shopId)) return json({ error: "Unknown shop" }, 404);
  const db = await getDb();
  const id = new ObjectId(shopId);
  const claimed = await claimShopJob(db, id, "pollLockUntil");
  if (!claimed) return json({ ok: true, skipped: true });
  try {
    const shop = await db.collection("shops").findOne({ _id: id });
    if (!shop?.emailConnect?.username) return json({ ok: true, ingested: 0 });
    const result = await pollShop(db, shop);
    return json({ ok: true, shop: shop.email, ...result });
  } catch (error) {
    console.error("poll", shopId, error);
    return json({ error: error.message || "Inbox check failed" }, 500);
  } finally {
    await releaseShopJob(db, id, "pollLockUntil");
  }
}

export async function GET(req, { params }) {
  const { shopId } = await params;
  return run(req, shopId);
}

export async function POST(req, { params }) {
  const { shopId } = await params;
  return run(req, shopId);
}
