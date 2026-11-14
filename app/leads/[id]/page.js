import { notFound, redirect } from "next/navigation";
import { leadQueryId } from "@/lib/ingest";
import { currentShop } from "@/lib/session";
import { formatWhen } from "@/lib/time";
import DetailClient from "./detail-client";
import LiveRefresh from "../../live-refresh";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }) {
  const { id } = await params;
  let ctx;
  try {
    ctx = await currentShop();
  } catch (error) {
    return (
      <main className="screen">
        <p className="brand">Traack</p>
        <h2>Setup needed</h2>
        <p className="lead">{error.message}</p>
      </main>
    );
  }
  if (!ctx) redirect("/api/session/clear");
  const leadId = leadQueryId(id);
  if (!leadId) notFound();

  const lead = await ctx.db.collection("leads").findOne({ _id: leadId, shopId: ctx.shop._id });
  if (!lead) notFound();
  if (lead.unreadCount > 0) {
    await ctx.db.collection("leads").updateOne({ _id: lead._id }, { $set: { unreadCount: 0 } });
  }
  const messages = await ctx.db.collection("messages").find({ leadId: lead._id }).sort({ at: 1 }).toArray();
  const latest = [...messages].reverse().find((message) => message.direction === "in");
  const title = (lead.subject || lead.snippet || "Lead").slice(0, 80);

  return (
    <>
    <LiveRefresh />
    <DetailClient
      lead={{
        id: lead._id.toString(),
        number: lead.number,
        name: lead.customerName || "Unknown",
        status: lead.status,
        email: lead.customerEmail || "",
        phone: lead.customerPhone || "",
        aiNote: lead.aiNote || "",
        subjectLine: `${title} · ${lead.channel} · ${formatWhen(lead.createdAt || lead.lastCustomerAt)}`,
        openUrl: lead.threadTrashedAt ? "" : latest?.openUrl || (lead.customerEmail ? `mailto:${lead.customerEmail}` : ""),
        canTrash: ctx.shop.emailConnect?.type === "gmail" && messages.some((message) => message.threadId || String(message.openUrl || "").includes("#inbox/")) && !lead.threadTrashedAt,
        threadTrashed: Boolean(lead.threadTrashedAt),
        threadTrashedWhen: lead.threadTrashedAt ? formatWhen(lead.threadTrashedAt) : "",
        messages: messages.map((message) => ({
          id: message._id.toString(),
          direction: message.direction,
          body: message.body || "",
          when: formatWhen(message.at),
          latest: latest ? message._id.toString() === latest._id.toString() : false,
          label: message.direction === "out" ? "sent" : "customer",
        })),
      }}
    />
    </>
  );
}
