import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { encrypt, readState } from "@/lib/crypto";
import { publicOrigin } from "@/lib/http";
import { exchangeCode, googleEmail } from "@/lib/gmail";
import { getDb } from "@/lib/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const origin = publicOrigin(req);
  const code = req.nextUrl.searchParams.get("code");
  const shopId = readState(req.nextUrl.searchParams.get("state") || "");
  if (!code || !shopId || !ObjectId.isValid(shopId)) {
    return NextResponse.redirect(new URL("/connect?error=google", origin));
  }
  try {
    const tokens = await exchangeCode({ origin, code });
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/connect?error=google", origin));
    }
    const email = await googleEmail(tokens.access_token);
    const db = await getDb();
    await db.collection("shops").updateOne(
      { _id: new ObjectId(shopId) },
      {
        $set: {
          emailConnect: {
            type: "gmail",
            username: email,
            refreshTokenEnc: encrypt(tokens.refresh_token),
            connectedAt: new Date(),
          },
        },
      }
    );
    return NextResponse.redirect(new URL("/connect?google=connected", origin));
  } catch (error) {
    console.error("google callback", error);
    return NextResponse.redirect(new URL("/connect?error=google", origin));
  }
}
