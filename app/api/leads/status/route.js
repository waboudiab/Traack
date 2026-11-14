import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { leadQueryId, setLeadStatus } from "@/lib/ingest";
import { getDb } from "@/lib/mongo";
import { readStatusToken } from "@/lib/status-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const labels = { new: "New", pending: "Pending", done: "Done", declined: "Declined" };

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title, body) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="font-family:sans-serif;padding:24px;color:#1c1226;background:#f3eef8;"><h1 style="font-size:22px;">${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req) {
  const data = readStatusToken(new URL(req.url).searchParams.get("t"));
  if (!data) return page("Link expired", "This status link is no longer valid.");
  const db = await getDb();
  const leadId = leadQueryId(data.leadId);
  if (!leadId) return page("Lead not found", "That lead is not in Traack.");
  const lead = await db.collection("leads").findOne({ _id: leadId });
  if (!lead) return page("Lead not found", "That lead is not in Traack.");
  const shop = await db.collection("shops").findOne({ _id: lead.shopId });
  if (!shop) return page("Lead not found", "That lead is not in Traack.");
  try {
    const result = await setLeadStatus(db, shop, lead, data.status);
    revalidatePath("/leads");
    revalidatePath(`/leads/${data.leadId}`);
    if (result.status !== data.status) return page("Not updated", result.toast || "Could not update the lead.");
    return page(`Marked ${labels[data.status]}`, `Lead #${lead.number} is ${labels[data.status]}. ${result.toast || ""}`.trim());
  } catch (error) {
    return page("Not updated", error.message || "Could not update the lead.");
  }
}
