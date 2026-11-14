import { encrypt } from "@/lib/crypto";
import { json } from "@/lib/http";
import { testMailbox } from "@/lib/mail";
import { resolveMailbox } from "@/lib/presets";
import { currentShop } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const ctx = await currentShop().catch((error) => ({ error }));
  if (ctx?.error) return json({ error: ctx.error.message }, 500);
  if (!ctx?.shop) return json({ error: "Sign in required." }, 401);

  const body = await req.json().catch(() => ({}));
  const box = resolveMailbox(body);
  if (!/^\S+@\S+\.\S+$/.test(box.username)) {
    return json({ error: "Enter a valid mailbox email." }, 400);
  }
  try {
    await testMailbox(box);
  } catch (error) {
    return json({ error: error.message || "Connection failed." }, 400);
  }

  if (body.mode !== "save") return json({ ok: true, message: "Connection works." });

  const { password, ...rest } = box;
  try {
    await ctx.db.collection("shops").updateOne(
      { _id: ctx.shop._id },
      {
        $set: {
          emailConnect: {
            type: "imap",
            ...rest,
            passwordEnc: encrypt(password),
            connectedAt: new Date(),
          },
        },
      }
    );
  } catch (error) {
    return json({ error: error.message || "Could not save the inbox." }, 500);
  }
  return json({ ok: true, message: "Inbox saved." });
}
