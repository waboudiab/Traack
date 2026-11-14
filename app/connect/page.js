import { redirect } from "next/navigation";
import { googleConfigured, googleRedirectUri } from "@/lib/gmail";
import { currentShop } from "@/lib/session";
import ConnectForm from "./connect-form";

export const dynamic = "force-dynamic";

export default async function ConnectPage({ searchParams }) {
  const params = await searchParams;
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

  let notice = "";
  let saved = "";
  if (params.google === "connected") saved = "Google inbox connected.";
  if (params.error === "google") notice = "Google connection failed. You can use IMAP instead.";
  if (params.error === "google_config") notice = "Google OAuth is not configured. Use other email (IMAP).";

  const shop = {
    emailConnect: ctx.shop.emailConnect
      ? {
          type: ctx.shop.emailConnect.type,
          username: ctx.shop.emailConnect.username,
          preset: ctx.shop.emailConnect.preset || "generic",
          imapHost: ctx.shop.emailConnect.imapHost || "",
          imapPort: ctx.shop.emailConnect.imapPort || 993,
          smtpHost: ctx.shop.emailConnect.smtpHost || "",
          smtpPort: ctx.shop.emailConnect.smtpPort || 465,
          tls: ctx.shop.emailConnect.tls !== false,
        }
      : null,
    phone: ctx.shop.phone
      ? {
          twilioNumber: ctx.shop.phone.twilioNumber,
          ownerMobile: ctx.shop.phone.ownerMobile,
          callMode: ctx.shop.phone.callMode,
        }
      : null,
    settings: { ownerMobile: ctx.shop.settings?.ownerMobile || "" },
  };

  return (
    <ConnectForm
      shop={shop}
      googleEnabled={googleConfigured()}
      googleRedirectUri={googleRedirectUri("http://localhost:3000")}
      notice={notice}
      saved={saved}
    />
  );
}
