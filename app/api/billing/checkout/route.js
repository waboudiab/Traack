import { currentShop } from "@/lib/session";
import { json, publicOrigin } from "@/lib/http";
import { createCheckout } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const ctx = await currentShop().catch(() => null);
  if (!ctx?.shop) return json({ error: "Sign in required." }, 401);
  try {
    const result = await createCheckout(ctx.shop, publicOrigin(req));
    if (result.error) return json({ error: result.error }, 400);
    return json({ url: result.url });
  } catch (error) {
    console.error("checkout", error);
    return json({ error: "Could not open the card page." }, 500);
  }
}
