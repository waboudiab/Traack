import { currentShop } from "@/lib/session";
import { json, publicOrigin } from "@/lib/http";
import { createPortal } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const ctx = await currentShop().catch(() => null);
  if (!ctx?.shop) return json({ error: "Sign in required." }, 401);
  try {
    const result = await createPortal(ctx.shop, publicOrigin(req));
    if (result.error) return json({ error: result.error }, 400);
    return json({ url: result.url });
  } catch (error) {
    console.error("portal", error);
    return json({ error: "Could not open card settings." }, 500);
  }
}
