import { redirect } from "next/navigation";
import { defaultSettings } from "@/lib/presets";
import { currentShop } from "@/lib/session";
import { vapidPublicKey } from "@/lib/push";
import { nudgeMinutes } from "@/lib/time";
import { applyCheckoutSession, billingSummary } from "@/lib/billing";
import SettingsForm from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }) {
  const query = await searchParams;
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
  let shop = ctx.shop;
  let note = "";
  if (query.billing === "success" && query.session_id) {
    try {
      shop = (await applyCheckoutSession(ctx.db, shop, String(query.session_id))) || shop;
      note = "Card saved.";
    } catch (error) {
      note = error.message || "The card page finished, but Traack could not record it yet.";
    }
  }
  if (query.billing === "cancel") note = "The card was not added.";
  const billing = { ...billingSummary(shop), note };
  const settings = { ...defaultSettings(), ...(shop.settings || {}) };
  settings.ownerMobile = shop.phone?.ownerMobile || settings.ownerMobile || "";
  settings.nudgeHours = nudgeMinutes(settings.nudgeHours);
  settings.leadKeywords = Array.isArray(settings.leadKeywords) ? settings.leadKeywords.join("\n") : "";
  settings.skipKeywords = Array.isArray(settings.skipKeywords) ? settings.skipKeywords.join("\n") : "";
  return <SettingsForm settings={settings} notifyKey={vapidPublicKey()} billing={billing} />;
}
