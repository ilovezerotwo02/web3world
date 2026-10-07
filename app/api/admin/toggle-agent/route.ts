import { getDb } from "../../../../db";
import { requireAdmin } from "../../../../lib/auth";
import { setConfig, logAdminAction } from "../../../../lib/repositories";

// POST /api/admin/toggle-agent — 开启/关闭 Agent 审核
export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as { enabled: boolean; reason?: string };
  const { enabled, reason } = body;

  const newValue = enabled === true ? "true" : "false";
  await setConfig(db, "agent_review_enabled", newValue);

  await logAdminAction(
    db,
    "toggle_agent_review",
    auth.userId,
    "config",
    "agent_review_enabled",
    undefined,
    { enabled: newValue },
    reason,
  );

  return Response.json({
    message: `Agent 审核已${enabled ? "开启" : "关闭"}`,
    agent: { enabled: enabled === true },
  });
}