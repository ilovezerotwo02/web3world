import { and, eq, asc, desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { courses, chapters, challengeAttempts, finalQuizAttempts, courseProgress } from "../../../db/schema";
import { requireAuth } from "../../../lib/auth";

// ---------------------------------------------------------------------------
// GET /api/review — 课程复习（已完成课程回看）
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");

  if (!courseId) {
    return Response.json({ error: "courseId 不能为空" }, { status: 400 });
  }

  // 检查进度：必须已完成课程（harvested == true）
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

  if (!progress || !progress.harvested) {
    return Response.json({ error: "该课程尚未完成，无法复习" }, { status: 403 });
  }

  // 获取课程信息
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return Response.json({ error: "课程不存在" }, { status: 404 });
  }

  // 获取章节列表（含知识卡）
  const courseChapters = await db
    .select()
    .from(chapters)
    .where(eq(chapters.courseId, courseId))
    .orderBy(asc(chapters.number));

  const chaptersData = courseChapters.map((ch) => ({
    id: ch.id,
    number: ch.number,
    title: ch.title,
    objective: ch.objective,
    terms: JSON.parse(ch.terms || "[]"),
    knowledgeCard: JSON.parse(ch.knowledgeCard || "{}"),
  }));

  // 获取错题记录（挑战答题中的错误答案）
  const mistakes = await db
    .select()
    .from(challengeAttempts)
    .where(
      and(
        eq(challengeAttempts.userId, auth.userId),
        eq(challengeAttempts.courseId, courseId),
        eq(challengeAttempts.passed, 0),
      ),
    )
    .orderBy(asc(challengeAttempts.chapterNumber), desc(challengeAttempts.attemptNumber));

  // 获取结课小测错题
  const quizMistakes = await db
    .select()
    .from(finalQuizAttempts)
    .where(
      and(
        eq(finalQuizAttempts.userId, auth.userId),
        eq(finalQuizAttempts.courseId, courseId),
        eq(finalQuizAttempts.passed, 0),
      ),
    )
    .orderBy(desc(finalQuizAttempts.createdAt));

  return Response.json({
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
    },
    chapters: chaptersData,
    mistakes: {
      challenges: mistakes.map((m) => ({
        chapterNumber: m.chapterNumber,
        answersBlob: JSON.parse(m.answersBlob || "{}"),
        attemptedAt: m.createdAt,
      })),
      quiz: quizMistakes.map((q) => ({
        answersBlob: JSON.parse(q.answersBlob || "{}"),
        attemptedAt: q.createdAt,
      })),
    },
  });
}