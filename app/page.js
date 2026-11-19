import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongo";
import { hasSessionCookie } from "@/lib/session";
import Landing from "./landing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Traack — Keep the lead in your inbox",
  description:
    "Link the business email you already use. Traack sends your reply in minutes, keeps the lead on your phone, and asks for a Google review when the job is done. $19.99 a month.",
};

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    if (await hasSessionCookie()) redirect("/api/session/clear");
    return <Landing />;
  }

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
