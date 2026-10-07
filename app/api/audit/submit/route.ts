import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditSessions, courseProgress } from "../../../../db/schema";
import { requireAuth } from "../../../../lib/auth";

// POST /api/audit/submit — 提交审核项
export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as {
    courseId: string;
    items: unknown[];
  };

  const { courseId, items } = body;

  if (!courseId || !items || !Array.isArray(items)) {
    return Response.json({ error: "courseId 和 items 不能为空" }, { status: 400 });
  }

  const [session] = await db
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

  if (!session) {
    return Response.json({ error: "没有进行中的审核会话，请先开始审核" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const existingItems = JSON.parse(session.itemsJson);
  const mergedItems = [...existingItems, ...items];

  if (session.auditType === "agent") {
    const allPassed = mergedItems.every(
      (item: { passed?: boolean }) => item.passed === true,
    );

    await db
      .update(auditSessions)
      .set({
        itemsJson: JSON.stringify(mergedItems),
        status: allPassed ? "passed" : "failed",
        completedAt: allPassed ? now : null,
      })
      .where(eq(auditSessions.id, session.id));

    if (allPassed) {
      await db
        .update(courseProgress)
        .set({ verification: "passed", updatedAt: now })
        .where(
          and(
            eq(courseProgress.userId, auth.userId),
            eq(courseProgress.courseId, courseId),
          ),
        );
    }

    return Response.json({
      session: {
        id: session.id,
        status: allPassed ? "passed" : "in_progress",
        auditType: session.auditType,
        items: mergedItems,
      },
      message: allPassed ? "审核通过！" : "部分审核项未通过，请继续完善",
    });
  }

  // 人工模式
  await db
    .update(auditSessions)
    .set({ itemsJson: JSON.stringify(mergedItems) })
    .where(eq(auditSessions.id, session.id));

  return Response.json({
    session: {
      id: session.id,
      status: "pending",
      auditType: session.auditType,
      items: mergedItems,
    },
    message: "已提交审核，等待管理员审核",
  });
}