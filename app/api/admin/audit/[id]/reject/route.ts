import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { auditSessions } from "../../../../../../db/schema";
import { requireAdmin } from "../../../../../../lib/auth";
import { logAdminAction } from "../../../../../../lib/repositories";

// POST /api/admin/audit/:id/reject — 审核拒绝
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
    .set({ status: "failed", completedAt: now })
    .where(eq(auditSessions.id, id));

  await logAdminAction(
    db,
    "audit_reject",
    auth.userId,
    "audit_session",
    id,
    { status: session.status },
    { status: "failed", completedAt: now },
    reason,
  );

  return Response.json({
    message: "审核已拒绝",
    session: { id, status: "failed", completedAt: now },
  });
}