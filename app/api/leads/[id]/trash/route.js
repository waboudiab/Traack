import { revalidatePath } from "next/cache";
import { json } from "@/lib/http";
import { leadQueryId } from "@/lib/ingest";
import { trashLeadThread } from "@/lib/outbound";
import { currentShop } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reasons = {
  gmail_only: "Delete thread works when the shop inbox is Gmail.",
  no_thread: "This lead has no Gmail thread to move.",
};

export async function POST(_req, context) {
  const ctx = await currentShop().catch((error) => ({ error }));
  if (ctx?.error) return json({ error: ctx.error.message }, 500);
  if (!ctx?.shop) return json({ error: "Sign in required." }, 401);

  const { id } = await context.params;
  const leadId = leadQueryId(id);
  if (!leadId) return json({ error: "Lead not found." }, 404);
  const lead = await ctx.db.collection("leads").findOne({ _id: leadId, shopId: ctx.shop._id });
  if (!lead) return json({ error: "Lead not found." }, 404);

  try {
    const result = await trashLeadThread(ctx.db, ctx.shop, lead);
    if (!result.ok) return json({ error: reasons[result.reason] || "Could not move the thread to Trash." }, 400);
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    return json({ ok: true, toast: "Thread moved to Gmail Trash. This lead stays in Traack." });
  } catch (error) {
    console.error("trash thread", error);
    return json({ error: "Gmail could not move that thread to Trash." }, 502);
  }
}
