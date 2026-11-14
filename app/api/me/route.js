import { json } from "@/lib/http";
import { currentShop } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await currentShop();
    if (!ctx) return json({ error: "Sign in required." }, 401);
    const { shop } = ctx;
    return json({
      name: shop.name,
      email: shop.email,
      emailConnected: Boolean(shop.emailConnect?.username),
      phoneConnected: Boolean(shop.phone?.twilioNumber),
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
