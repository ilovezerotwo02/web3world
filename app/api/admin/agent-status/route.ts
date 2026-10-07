import { getDb } from "../../../../db";
import { requireAdmin } from "../../../../lib/auth";
import { getConfig } from "../../../../lib/repositories";

// GET /api/admin/agent-status — Agent 服务状态
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const agentEnabled = await getConfig(db, "agent_review_enabled", "false");

  return Response.json({
    enabled: agentEnabled === "true",
    configKey: "agent_review_enabled",
  });
}