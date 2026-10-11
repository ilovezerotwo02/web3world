import { eq, asc } from "drizzle-orm";
import { getDb } from "../../../db";
import { chapters } from "../../../db/schema";
import { requireAuth } from "../../../lib/auth";

// ---------------------------------------------------------------------------
// GET /api/knowledge-cards — 知识卡回看
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");

  if (!courseId) {
    // 返回用户所有课程的知识卡
    return Response.json({ error: "courseId 不能为空" }, { status: 400 });
  }

  const courseChapters = await db
    .select()
    .from(chapters)
    .where(eq(chapters.courseId, courseId))
    .orderBy(asc(chapters.number));

  return Response.json({
    courseId,
    cards: courseChapters.map((ch) => ({
      chapterNumber: ch.number,
      chapterTitle: ch.title,
      terms: JSON.parse(ch.terms || "[]"),
      knowledgeCard: JSON.parse(ch.knowledgeCard || "{}"),
    })),
  });
}