import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongo";
import { hasSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect((await hasSessionCookie()) ? "/api/session/clear" : "/login");

  if (!ObjectId.isValid(session.user.id)) redirect("/api/session/clear");

  let shop;
  try {
    const db = await getDb();
    shop = await db.collection("shops").findOne({ _id: new ObjectId(session.user.id) });
  } catch (error) {
    return (
      <main className="screen">
        <p className="brand">Traack</p>
        <h2>Setup needed</h2>
        <p className="lead">{error.message}</p>
      </main>
    );
  }

  if (!shop) redirect("/api/session/clear");
  redirect(shop.emailConnect?.username ? "/leads" : "/connect");
}
