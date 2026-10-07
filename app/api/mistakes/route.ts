import { eq, and, asc, desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { challengeAttempts, finalQuizAttempts } from "../../../db/schema";
import { requireAuth } from "../../../lib/auth";

// ---------------------------------------------------------------------------
// GET /api/mistakes — 错题回看
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

  // 挑战错题
  const challengeMistakes = await db
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

  // 结课小测错题
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
    courseId,
    challenges: challengeMistakes.map((m) => ({
      chapterNumber: m.chapterNumber,
      answers: JSON.parse(m.answersBlob || "{}"),
      attemptedAt: m.createdAt,
    })),
    quiz: quizMistakes.map((q) => ({
      answers: JSON.parse(q.answersBlob || "{}"),
      attemptedAt: q.createdAt,
    })),
  });
}