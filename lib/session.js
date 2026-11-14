import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions } from "./auth";
import { getDb } from "./mongo";

export async function hasSessionCookie() {
  const jar = await cookies();
  return Boolean(jar.get("next-auth.session-token") || jar.get("__Secure-next-auth.session-token"));
}

export async function currentShop() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id || !ObjectId.isValid(id)) return null;
  const db = await getDb();
  const shop = await db.collection("shops").findOne({ _id: new ObjectId(id) });
  return shop ? { db, shop } : null;
}
