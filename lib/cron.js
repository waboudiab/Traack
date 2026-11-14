import { after } from "next/server";
import { json, publicOrigin } from "./http";

const LOCK_MS = 2 * 60 * 1000;

export async function claimShopJob(db, shopId, field) {
  const now = new Date();
  const until = new Date(now.getTime() + LOCK_MS);
  const result = await db.collection("shops").updateOne(
    {
      _id: shopId,
      $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: { $lte: now } }],
    },
    { $set: { [field]: until } }
  );
  return result.modifiedCount === 1;
}

export async function releaseShopJob(db, shopId, field) {
  await db.collection("shops").updateOne({ _id: shopId }, { $set: { [field]: null } });
}

export function dispatchShopJobs(req, shops, pathFor) {
  const origin = publicOrigin(req);
  const headers = {};
  if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
  const ids = shops.map((shop) => String(shop._id));

  after(async () => {
    await Promise.all(
      ids.map(async (id) => {
        const path = pathFor(id);
        try {
          const res = await fetch(`${origin}${path}`, { method: "POST", headers });
          if (!res.ok) console.error("cron dispatch", path, res.status);
        } catch (error) {
          console.error("cron dispatch", path, error);
        }
      })
    );
  });

  return json({ ok: true, queued: ids.length });
}
