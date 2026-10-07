import { count, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users, courseProgress } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/auth";
import { getConfig } from "../../../../lib/repositories";

// GET /api/admin/status — 系统状态总览
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const [userCount] = await db.select({ total: count() }).from(users);
  const [activeCourses] = await db
    .select({ total: count() })
    .from(courseProgress)
    .where(eq(courseProgress.harvested, 0));
  const [completedCourses] = await db
    .select({ total: count() })
    .from(courseProgress)
    .where(eq(courseProgress.harvested, 1));

  const agentEnabled = await getConfig(db, "agent_review_enabled", "false");
  const maintenanceMode = await getConfig(db, "maintenance_mode", "false");

  return Response.json({
    users: { total: userCount?.total ?? 0 },
    courses: {
      inProgress: activeCourses?.total ?? 0,
      completed: completedCourses?.total ?? 0,
    },
    agent: { enabled: agentEnabled === "true" },
    maintenance: { enabled: maintenanceMode === "true" },
  });
}