import { getDb } from "../../../db";
import { courses, chapters, challengeQuestions, finalQuizQuestions } from "../../../db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");

  if (!courseId) {
    return Response.json({ error: "courseId required" }, { status: 400 });
  }

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return Response.json({ error: "Course not found" }, { status: 404 });
  }

  const courseChapters = await db
    .select()
    .from(chapters)
    .where(eq(chapters.courseId, courseId))
    .orderBy(asc(chapters.number));

  const courseChallenges: { chapterId: string; questions: typeof challengeQuestions.$inferSelect[] }[] = [];
  for (const chapter of courseChapters) {
    const q = await db
      .select()
      .from(challengeQuestions)
      .where(eq(challengeQuestions.chapterId, chapter.id));
    courseChallenges.push({ chapterId: chapter.id, questions: q });
  }

  const courseQuiz = await db
    .select()
    .from(finalQuizQuestions)
    .where(eq(finalQuizQuestions.courseId, courseId));

  return Response.json({
    course: {
      ...course,
      chapters: courseChapters.map((c) => ({
        ...c,
        terms: JSON.parse(c.terms || "[]"),
        knowledgeCard: JSON.parse(c.knowledgeCard || "{}"),
      })),
      challenges: courseChallenges,
      quiz: courseQuiz.map((q) => ({
        ...q,
        questionBlob: JSON.parse(q.questionBlob || "{}"),
      })),
    },
  });
}
