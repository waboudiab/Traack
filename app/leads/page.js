import { redirect } from "next/navigation";
import { currentShop } from "@/lib/session";
import { relativeWhen } from "@/lib/time";
import LeadsList from "./leads-list";
import LiveRefresh from "../live-refresh";
import { billingSummary } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }) {
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
  const query = await searchParams;
  const notice = query.sent === "maps" ? "Google Maps link sent. That lead left the queue." : "";
  const leads = await ctx.db
    .collection("leads")
    .find({ shopId: ctx.shop._id })
    .sort({ lastCustomerAt: -1 })
    .limit(200)
    .toArray();

  return (
    <>
    <LiveRefresh />
    <LeadsList
      notice={notice}
      billingMessage={billingSummary(ctx.shop).message}
      leads={leads.map((lead) => ({
        id: lead._id.toString(),
        number: lead.number,
        channel: lead.channel,
        status: lead.status,
        hot: Boolean(lead.hot),
        name: lead.customerName || "Unknown",
        unreadCount: lead.unreadCount || 0,
        snippet: lead.snippet || "",
        replySent: Boolean(lead.ackedAt),
        reminderSent: Boolean(lead.nudgeFor && lead.lastCustomerAt && new Date(lead.nudgeFor) >= new Date(lead.lastCustomerAt)),
        reviewSent: Boolean(lead.reviewSentAt),
        lastCustomerAt: lead.lastCustomerAt ? new Date(lead.lastCustomerAt).toISOString() : "",
        ago: relativeWhen(lead.lastCustomerAt || lead.createdAt),
        threadTrashed: Boolean(lead.threadTrashedAt),
      }))}
    />
    </>
  );
}
