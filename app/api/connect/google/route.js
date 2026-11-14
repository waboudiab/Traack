import { NextResponse } from "next/server";
import { signState } from "@/lib/crypto";
import { publicOrigin } from "@/lib/http";
import { googleAuthUrl, googleConfigured } from "@/lib/gmail";
import { currentShop } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const origin = publicOrigin(req);
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/connect?error=google_config", origin));
  }
  const ctx = await currentShop().catch(() => null);
  if (!ctx?.shop) return NextResponse.redirect(new URL("/login", origin));
  const url = googleAuthUrl({
    origin,
    state: signState(ctx.shop._id.toString()),
  });
  return NextResponse.redirect(url);
}
