import { and, eq, desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditSessions } from "../../../../db/schema";
import { requireAuth } from "../../../../lib/auth";

// GET /api/audit/status?courseId=X — 查询审核状态
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");

  if (!courseId) {
    return Response.json({ error: "courseId 不能为空" }, { status: 400 });
  }

  const [session] = await db
    .select()
    .from(auditSessions)
    .where(
      and(
        eq(auditSessions.userId, auth.userId),
        eq(auditSessions.courseId, courseId),
      ),
    )
    .orderBy(desc(auditSessions.createdAt))
    .limit(1);

  if (!session) {
    return Response.json({ session: null });
  }

  return Response.json({
    session: {
      id: session.id,
      auditType: session.auditType,
      status: session.status,
      items: JSON.parse(session.itemsJson),
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    },
  });
}