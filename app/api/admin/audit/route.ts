import { eq, asc, desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditSessions, users } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/auth";

// GET /api/admin/audit — 待审核列表
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const status = searchParams.get("status") || "pending";

  let rows;
  if (userId) {
    rows = await db
      .select({ session: auditSessions, user: users })
      .from(auditSessions)
      .innerJoin(users, eq(auditSessions.userId, users.id))
      .where(eq(auditSessions.userId, userId))
      .orderBy(desc(auditSessions.createdAt));
  } else {
    rows = await db
      .select({ session: auditSessions, user: users })
      .from(auditSessions)
      .innerJoin(users, eq(auditSessions.userId, users.id))
      .where(eq(auditSessions.status, status))
      .orderBy(asc(auditSessions.createdAt));
  }

  return Response.json({
    sessions: rows.map((r) => ({
      id: r.session.id,
      userId: r.session.userId,
      username: r.user.username,
      courseId: r.session.courseId,
      auditType: r.session.auditType,
      status: r.session.status,
      items: JSON.parse(r.session.itemsJson),
      startedAt: r.session.startedAt,
      completedAt: r.session.completedAt,
      createdAt: r.session.createdAt,
    })),
  });
}