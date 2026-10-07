import { getDb } from "../../../../db";
import { requireAdmin } from "../../../../lib/auth";
import { setConfig, logAdminAction } from "../../../../lib/repositories";

// POST /api/admin/toggle-maintenance — 开启/关闭维护模式
export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as { enabled: boolean; reason?: string };
  const { enabled, reason } = body;

  const newValue = enabled === true ? "true" : "false";
  await setConfig(db, "maintenance_mode", newValue);

  await logAdminAction(
    db,
    "toggle_maintenance",
    auth.userId,
    "config",
    "maintenance_mode",
    undefined,
    { enabled: newValue },
    reason,
  );

  return Response.json({
    message: `维护模式已${enabled ? "开启" : "关闭"}`,
    maintenance: { enabled },
  });
}