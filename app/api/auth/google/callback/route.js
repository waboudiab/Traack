import crypto from "crypto";
import { NextResponse } from "next/server";
import { readState } from "@/lib/crypto";
import { exchangeCode, googleEmail } from "@/lib/gmail";
import { publicOrigin } from "@/lib/http";
import { getDb } from "@/lib/mongo";
import { defaultSettings } from "@/lib/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loginState(state) {
  const value = readState(state);
  if (!value) return null;
  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!payload || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function GET(req) {
  const origin = publicOrigin(req);
  const fail = (code) => NextResponse.redirect(new URL(`/login?error=${code}`, origin));
  if (req.nextUrl.searchParams.get("error")) return fail("google");
  const code = req.nextUrl.searchParams.get("code");
  const payload = loginState(req.nextUrl.searchParams.get("state") || "");
  if (!code || !payload) return fail("google");

  try {
    const tokens = await exchangeCode({
      origin,
      code,
      redirectUri: `${origin}/api/auth/google/callback`,
    });
    const email = await googleEmail(tokens.access_token);
    if (!email) return fail("google");
    const db = await getDb();
    let shop = await db.collection("shops").findOne({ email });
    if (!shop) {
      const name = String(payload.name || "").trim().slice(0, 80);
      if (name.length < 2) return fail("no_shop");
      const created = await db.collection("shops").insertOne({
        name,
        email,
        passwordHash: null,
        createdAt: new Date(),
        nextLeadNumber: 100,
        emailConnect: null,
        phone: null,
        settings: defaultSettings(),
      });
      shop = { _id: created.insertedId };
    }
    const ticket = crypto.randomBytes(32).toString("hex");
    await db.collection("shops").updateOne(
      { _id: shop._id },
      { $set: { loginTicket: ticket, loginTicketUntil: new Date(Date.now() + 2 * 60 * 1000) } }
    );
    return NextResponse.redirect(new URL(`/login?ticket=${ticket}`, origin));
  } catch (error) {
    console.error("google sign-in", error);
    return fail("google");
  }
}
