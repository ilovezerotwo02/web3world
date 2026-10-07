import { eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import { courseProgress } from "../../../db/schema";
import { requireAuth } from "../../../lib/auth";

// ---------------------------------------------------------------------------
// POST /api/verification — 切换验证方式
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as {
    courseId: string;
    method: "quiz" | "audit";
  };

  const { courseId, method } = body;

  if (!courseId || !method) {
    return Response.json({ error: "courseId 和 method 不能为空" }, { status: 400 });
  }

  if (method !== "quiz" && method !== "audit") {
    return Response.json({ error: "method 必须是 quiz 或 audit" }, { status: 400 });
  }

  // 获取当前进度
  const [progress] = await db
    .select()
    .from(courseProgress)
    .where(
      and(
        eq(courseProgress.userId, auth.userId),
        eq(courseProgress.courseId, courseId),
      ),
    )
    .limit(1);

  if (!progress) {
    return Response.json({ error: "课程进度不存在，请先开始课程" }, { status: 404 });
  }

  if (progress.verification === "passed") {
    return Response.json({ error: "验证已通过，无需切换" }, { status: 400 });
  }

  // 切换验证方式
  const now = new Date().toISOString();
  const newVerification = method === "quiz" ? "quiz" : "audit";

  await db
    .update(courseProgress)
    .set({ verification: newVerification, updatedAt: now })
    .where(
      and(
        eq(courseProgress.userId, auth.userId),
        eq(courseProgress.courseId, courseId),
      ),
    );

  return Response.json({
    message: `已切换为${method === "quiz" ? "结课小测" : "审核"}验证`,
    verification: newVerification,
  });
}