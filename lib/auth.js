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
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;
        const db = await getDb();
        const shop = await db.collection("shops").findOne({ email });
        if (!shop) return null;
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
