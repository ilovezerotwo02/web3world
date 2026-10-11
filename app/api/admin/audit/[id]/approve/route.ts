import { eq, and } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { auditSessions, courseProgress } from "../../../../../../db/schema";
import { requireAdmin } from "../../../../../../lib/auth";
import { logAdminAction } from "../../../../../../lib/repositories";

// POST /api/admin/audit/:id/approve — 审核通过
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const { id } = params;
  const body = (await request.json()) as { reason?: string };
  const { reason } = body;

  const [session] = await db
    .select()
    .from(auditSessions)
    .where(eq(auditSessions.id, id))
    .limit(1);

  if (!session) {
    return Response.json({ error: "审核会话不存在" }, { status: 404 });
  }

  if (session.status !== "pending" && session.status !== "in_progress") {
    return Response.json({ error: "该审核会话已处理" }, { status: 400 });
  }

  const now = new Date().toISOString();

  await db
    .update(auditSessions)
    .set({ status: "passed", completedAt: now })
    .where(eq(auditSessions.id, id));

  await db
    .update(courseProgress)
    .set({ verification: "passed", updatedAt: now })
    .where(
        and(
          eq(courseProgress.userId, session.userId),
          eq(courseProgress.courseId, session.courseId),
        ),
      );

  await logAdminAction(
    db,
    "audit_approve",
    auth.userId,
    "audit_session",
    id,
    { status: session.status },
    { status: "passed", completedAt: now },
    reason,
  );

  return Response.json({
    message: "审核已通过",
    session: { id, status: "passed", completedAt: now },
  });
}