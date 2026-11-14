import { envReport } from "@/lib/required-env";
import { assertCron, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEPLOY_MARK = "shop-push-1";

export function GET(req) {
  if (!assertCron(req)) return json({ error: "Unauthorized", mark: DEPLOY_MARK }, 401);
  return json({ ...envReport({ production: process.env.NODE_ENV === "production" }), mark: DEPLOY_MARK });
}
