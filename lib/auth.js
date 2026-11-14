import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb } from "./mongo";

export const authOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Shop login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const db = await getDb();
        const ticket = String(credentials?.ticket || "");
        if (ticket) {
          const shop = await db.collection("shops").findOne({
            loginTicket: ticket,
            loginTicketUntil: { $gt: new Date() },
          });
          if (!shop) return null;
          await db.collection("shops").updateOne(
            { _id: shop._id },
            { $unset: { loginTicket: "", loginTicketUntil: "" } }
          );
          return { id: shop._id.toString(), email: shop.email, name: shop.name };
        }
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;
        const shop = await db.collection("shops").findOne({ email });
        if (!shop?.passwordHash) return null;
        const ok = await bcrypt.compare(password, shop.passwordHash);
        if (!ok) return null;
        return { id: shop._id.toString(), email: shop.email, name: shop.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.shopId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.shopId;
      return session;
    },
  },
};
