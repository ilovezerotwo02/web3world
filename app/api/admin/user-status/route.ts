import { eq, desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users, courseProgress, systemLogs } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/auth";

// GET /api/admin/user-status?userId=X — 查看用户全状态
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId 不能为空" }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return Response.json({ error: "用户不存在" }, { status: 404 });
  }

  const progress = await db
    .select()
    .from(courseProgress)
    .where(eq(courseProgress.userId, userId))
    .orderBy(desc(courseProgress.updatedAt));

  const logs = await db
    .select()
    .from(systemLogs)
    .where(eq(systemLogs.targetId, userId))
    .orderBy(desc(systemLogs.createdAt))
    .limit(20);

  return Response.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      exp: user.exp,
      level: user.level,
      status: user.status,
    },
    progress: progress.map((p) => ({
      courseId: p.courseId,
      started: Boolean(p.started),
      harvested: Boolean(p.harvested),
      verification: p.verification,
      completedAt: p.completedAt,
    })),
    logs: logs.map((l) => ({
      action: l.action,
      beforeState: l.beforeState ? JSON.parse(l.beforeState) : null,
      afterState: l.afterState ? JSON.parse(l.afterState) : null,
      reason: l.reason,
      createdAt: l.createdAt,
    })),
  });
}