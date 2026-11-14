import { envReport } from "@/lib/required-env";
import { assertCron, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req) {
  if (!assertCron(req)) return json({ error: "Unauthorized" }, 401);
  return json(envReport({ production: process.env.NODE_ENV === "production" }));
}
