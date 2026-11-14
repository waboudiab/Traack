import { revalidatePath } from "next/cache";
import { json } from "@/lib/http";
import { leadQueryId, setLeadStatus } from "@/lib/ingest";
import { currentShop } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req, context) {
  const ctx = await currentShop().catch((error) => ({ error }));
  if (ctx?.error) return json({ error: ctx.error.message }, 500);
  if (!ctx?.shop) return json({ error: "Sign in required." }, 401);

  const { id } = await context.params;
  const leadId = leadQueryId(id);
  if (!leadId) return json({ error: "Lead not found." }, 404);
  const lead = await ctx.db.collection("leads").findOne({ _id: leadId, shopId: ctx.shop._id });
  if (!lead) return json({ error: "Lead not found." }, 404);

  const body = await req.json().catch(() => ({}));
  try {
    const result = await setLeadStatus(ctx.db, ctx.shop, lead, body.status);
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    return json(result);
  } catch (error) {
    return json({ error: error.message || "Could not update the lead." }, 400);
  }
}
