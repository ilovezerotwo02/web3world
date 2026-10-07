import { getDb } from "../../../../../db";
import { requireAdmin } from "../../../../../lib/auth";
import { getConfig } from "../../../../../lib/repositories";

// GET /api/admin/audit/config — 查看审核配置
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const agentEnabled = await getConfig(db, "agent_review_enabled", "false");

  return Response.json({
    agentReviewEnabled: agentEnabled === "true",
  });
}