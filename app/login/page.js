import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongo";
import { hasSessionCookie } from "@/lib/session";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    if (await hasSessionCookie()) redirect("/api/session/clear");
    return <LoginForm />;
  }
  let shop = null;
  try {
    if (ObjectId.isValid(session.user.id)) {
      const db = await getDb();
      shop = await db.collection("shops").findOne({ _id: new ObjectId(session.user.id) });
    }
  } catch {
    return <LoginForm />;
  }
  if (!shop) redirect("/api/session/clear");
  redirect("/");
}
