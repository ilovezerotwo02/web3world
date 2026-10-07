import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users, courseProgress } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/auth";
import { logAdminAction } from "../../../../lib/repositories";

// POST /api/admin/repair — 修复用户状态
export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as {
    userId: string;
    field: string;
    value: unknown;
    reason: string;
  };

  const { userId: targetUserId, field, value, reason } = body;

  if (!targetUserId || !field || !reason) {
    return Response.json({ error: "userId、field、reason 不能为空" }, { status: 400 });
  }

  const [before] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!before) {
    return Response.json({ error: "用户不存在" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const beforeState = { ...before };

  if (field.startsWith("progress.")) {
    const progressField = field.replace("progress.", "");
    await db
      .update(courseProgress)
      .set({ [progressField]: value, updatedAt: now })
      .where(eq(courseProgress.userId, targetUserId));
  } else {
    await db
      .update(users)
      .set({ [field]: value, updatedAt: now })
      .where(eq(users.id, targetUserId));
  }

  const [after] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  await logAdminAction(
    db,
    "repair",
    auth.userId,
    "user",
    targetUserId,
    beforeState,
    after ? { ...after } : undefined,
    reason,
  );

  return Response.json({
    message: "修复成功",
    before: { [field]: (beforeState as Record<string, unknown>)[field] },
    after: { [field]: value },
  });
}