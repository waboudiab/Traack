import { ObjectId } from "mongodb";
import { claimShopJob, releaseShopJob } from "@/lib/cron";
import { assertCron, json } from "@/lib/http";
import { getDb } from "@/lib/mongo";
import { nudgeShop } from "@/lib/poll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req, shopId) {
  if (!assertCron(req)) return json({ error: "Unauthorized" }, 401);
  if (!ObjectId.isValid(shopId)) return json({ error: "Unknown shop" }, 404);
  const db = await getDb();
  const id = new ObjectId(shopId);
  const claimed = await claimShopJob(db, id, "nudgeLockUntil");
  if (!claimed) return json({ ok: true, skipped: true });
  try {
    const shop = await db.collection("shops").findOne({ _id: id });
    if (!shop) return json({ error: "Unknown shop" }, 404);
    const result = await nudgeShop(db, shop);
    return json({ ok: true, shop: shop.email, ...result });
  } catch (error) {
    console.error("nudge", shopId, error);
    return json({ error: error.message || "Nudge failed" }, 500);
  } finally {
    await releaseShopJob(db, id, "nudgeLockUntil");
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
