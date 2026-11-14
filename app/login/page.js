import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { googleConfigured } from "@/lib/gmail";
import { getDb } from "@/lib/mongo";
import { hasSessionCookie } from "@/lib/session";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }) {
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    if (await hasSessionCookie()) redirect("/api/session/clear");
    return (
      <LoginForm
        googleEnabled={googleConfigured()}
        ticket={String(query.ticket || "")}
        errorCode={String(query.error || "")}
      />
    );
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
