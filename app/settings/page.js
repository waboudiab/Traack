import { redirect } from "next/navigation";
import { defaultSettings } from "@/lib/presets";
import { currentShop } from "@/lib/session";
import SettingsForm from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
  const settings = { ...defaultSettings(), ...(ctx.shop.settings || {}) };
  settings.ownerMobile = ctx.shop.phone?.ownerMobile || settings.ownerMobile || "";
  settings.leadKeywords = Array.isArray(settings.leadKeywords) ? settings.leadKeywords.join("\n") : "";
  settings.skipKeywords = Array.isArray(settings.skipKeywords) ? settings.skipKeywords.join("\n") : "";
  return <SettingsForm settings={settings} />;
}
