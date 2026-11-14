import { NextResponse } from "next/server";
import { signState } from "@/lib/crypto";
import { googleConfigured, googleSignInUrl } from "@/lib/gmail";
import { publicOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const origin = publicOrigin(req);
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }
  const name = String(req.nextUrl.searchParams.get("name") || "").trim().slice(0, 80);
  if (req.nextUrl.searchParams.has("name") && name.length < 2) {
    return NextResponse.redirect(new URL("/login?error=need_shop", origin));
  }
  const payload = Buffer.from(
    JSON.stringify({ name, exp: Date.now() + 10 * 60 * 1000 })
  ).toString("base64url");
  const url = googleSignInUrl({ origin, state: signState(payload) });
  return NextResponse.redirect(url);
}
