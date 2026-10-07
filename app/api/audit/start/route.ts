import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditSessions, courses } from "../../../../db/schema";
import { requireAuth } from "../../../../lib/auth";
import { getConfig } from "../../../../lib/repositories";

// POST /api/audit/start — 创建审核会话
export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as { courseId: string };
  const { courseId } = body;

  if (!courseId) {
    return Response.json({ error: "courseId 不能为空" }, { status: 400 });
  }

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return Response.json({ error: "课程不存在" }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(auditSessions)
    .where(
      and(
        eq(auditSessions.userId, auth.userId),
        eq(auditSessions.courseId, courseId),
        eq(auditSessions.status, "in_progress"),
      ),
    )
    .limit(1);

  if (existing) {
    return Response.json({
      session: {
        id: existing.id,
        auditType: existing.auditType,
        status: existing.status,
        items: JSON.parse(existing.itemsJson),
      },
    });
  }

  const agentConfig = await getConfig(db, "agent_review_enabled", "false");
  const auditType = agentConfig === "true" ? "agent" : "manual";

  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(auditSessions).values({
    id: sessionId,
    userId: auth.userId,
    courseId,
    auditType,
    status: "in_progress",
    itemsJson: "[]",
    startedAt: now,
  });

  const [session] = await db
    .select()
    .from(auditSessions)
    .where(eq(auditSessions.id, sessionId))
    .limit(1);

  return Response.json({
    session: {
      id: session!.id,
      auditType: session!.auditType,
      status: session!.status,
      items: JSON.parse(session!.itemsJson),
    },
  });
}