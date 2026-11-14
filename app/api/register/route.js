import bcrypt from "bcryptjs";
import { json } from "@/lib/http";
import { getDb } from "@/lib/mongo";
import { defaultSettings } from "@/lib/presets";

export const runtime = "nodejs";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Enter the shop name, email, and password." }, 400);
  }
  const name = String(body.name || "").trim().slice(0, 80);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (name.length < 2) return json({ error: "Enter the shop name." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Enter a valid email." }, 400);
  if (password.length < 8) return json({ error: "Use at least 8 characters for the password." }, 400);

  try {
    const db = await getDb();
    const existing = await db.collection("shops").findOne({ email });
    if (existing) return json({ error: "That email already has a shop account." }, 409);
    const passwordHash = await bcrypt.hash(password, 10);
    await db.collection("shops").insertOne({
      name,
      email,
      passwordHash,
      createdAt: new Date(),
      nextLeadNumber: 100,
      emailConnect: null,
      phone: null,
      settings: defaultSettings(),
    });
    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Could not create the account." }, 500);
  }
}
