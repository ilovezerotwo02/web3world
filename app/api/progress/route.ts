import { eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import { courseProgress } from "../../../db/schema";
import { progressReducer, type ProgressAction, type FarmProgress } from "../../../lib/progress";
import { addExp, recordChallengeAttempt, recordFinalQuizAttempt, checkPrerequisites } from "../../../lib/repositories";
import { EXP_REWARDS } from "../../../lib/exp";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    return JSON.parse(value) as T[];
  } catch {
    return [];
  }
}

function toFarmProgress(row: typeof courseProgress.$inferSelect): FarmProgress {
  const chaptersRead = parseJsonArray<boolean>(row.chaptersRead);
  const challengePassed = parseJsonArray<boolean>(row.challengePassed);
  const challengeMistakes = parseJsonArray<boolean>(row.challengeMistakes);

  function padTuple(arr: boolean[], size: number): [boolean, boolean, boolean] {
    const result: [boolean, boolean, boolean] = [false, false, false];
    for (let i = 0; i < size && i < arr.length; i++) {
      result[i] = arr[i];
    }
    return result;
  }

  return {
    version: 1,
    started: Boolean(row.started),
    seedGranted: Boolean(row.seedGranted),
    landCleared: Boolean(row.landCleared),
    planted: Boolean(row.planted),
    chaptersRead: padTuple(chaptersRead, 3),
    challengePassed: padTuple(challengePassed, 3),
    challengeMistakes: padTuple(challengeMistakes, 3),
    verification: (row.verification as FarmProgress["verification"]) ?? "none",
    harvested: Boolean(row.harvested),
    recentActivity: parseJsonArray<string>(row.recentActivity),
  };
}

function jsonArray<T>(arr: T[]): string {
  return JSON.stringify(arr);
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const courseId = searchParams.get("courseId");

  if (!userId || !courseId) {
    return Response.json({ error: "userId and courseId required" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(courseProgress)
    .where(
      and(
        eq(courseProgress.userId, userId),
        eq(courseProgress.courseId, courseId),
      ),
    )
    .limit(1);

  if (!row) {
    return Response.json({ progress: null });
  }

  return Response.json({ progress: row });
}

// ---------------------------------------------------------------------------
// POST — apply an action to the progress state machine
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json() as {
    userId: string;
    courseId: string;
    action: ProgressAction & { answers?: unknown };
  };

  const { userId, courseId, action } = body;

  if (!userId || !courseId || !action) {
    return Response.json({ error: "userId, courseId, and action required" }, { status: 400 });
  }

  // Get or create progress record
  let [row] = await db
    .select()
    .from(courseProgress)
    .where(
      and(
        eq(courseProgress.userId, userId),
        eq(courseProgress.courseId, courseId),
      ),
    )
    .limit(1);

  if (!row) {
    [row] = await db
      .insert(courseProgress)
      .values({ userId, courseId })
      .returning();
  }

  // --- Prerequisite validation for start-course action ---
  if (action.type === "start-course" && !row.started) {
    const err = await checkPrerequisites(db, userId, courseId);
    if (err) {
      return Response.json({ error: err }, { status: 403 });
    }
  }

  // Apply the state machine reducer
  const current = toFarmProgress(row);
  const next = progressReducer(current, action);

  // If nothing changed, return current state
  if (next === current) {
    return Response.json({ progress: row, changed: false });
  }

  // Detect which fields changed and build updates
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    started: next.started ? 1 : 0,
    seedGranted: next.seedGranted ? 1 : 0,
    landCleared: next.landCleared ? 1 : 0,
    planted: next.planted ? 1 : 0,
    chaptersRead: jsonArray(next.chaptersRead),
    challengePassed: jsonArray(next.challengePassed),
    challengeMistakes: jsonArray(next.challengeMistakes),
    verification: next.verification,
    harvested: next.harvested ? 1 : 0,
    recentActivity: jsonArray(next.recentActivity),
    updatedAt: now,
  };

  // Set completedAt when transitioning to harvested
  if (next.harvested && !current.harvested) {
    updates.completedAt = now;
  }

  const [updated] = await db
    .update(courseProgress)
    .set(updates)
    .where(
      and(
        eq(courseProgress.userId, userId),
        eq(courseProgress.courseId, courseId),
      ),
    )
    .returning();

  // --- Side effects: EXP rewards ---

  // Start course → seed granted
  if (action.type === "start-course" && next.seedGranted && !current.seedGranted) {
    await addExp(db, userId, EXP_REWARDS.START_COURSE, "start_course", `${courseId}-start`);
  }
  // Clear land
  if (action.type === "clear-land" && next.landCleared && !current.landCleared) {
    await addExp(db, userId, EXP_REWARDS.CLEAR_LAND, "clear_land", `${courseId}-clear`);
  }
  // Plant
  if (action.type === "plant" && next.planted && !current.planted) {
    await addExp(db, userId, EXP_REWARDS.PLANT, "plant", `${courseId}-plant`);
  }
  // Chapter read
  if (action.type === "complete-theory") {
    const chapter = action.chapter;
    if (next.chaptersRead[chapter] && !current.chaptersRead[chapter]) {
      await addExp(db, userId, EXP_REWARDS.CHAPTER_READ, "chapter_read", `${courseId}-ch${chapter}`);
    }
  }
  // Challenge passed
  if (action.type === "complete-challenge") {
    const chapter = action.chapter;
    if (next.challengePassed[chapter] && !current.challengePassed[chapter]) {
      await addExp(db, userId, EXP_REWARDS.CHALLENGE_PASSED, "challenge_passed", `${courseId}-ch${chapter}-pass`);
      // Perfect challenge bonus
      if (!next.challengeMistakes[chapter] && current.challengeMistakes[chapter] !== false) {
        await addExp(db, userId, EXP_REWARDS.CHALLENGE_PERFECT, "challenge_perfect", `${courseId}-ch${chapter}-perfect`);
      }
    }
  }
  // Verification passed
  if (action.type === "pass-verification" && next.verification === "passed" && current.verification !== "passed") {
    await addExp(db, userId, EXP_REWARDS.VERIFICATION_PASSED, "verification", `${courseId}-verify`);
  }

  // Record challenge attempt if answers provided
  if (action.type === "complete-challenge" && action.answers) {
    await recordChallengeAttempt(
      db,
      userId,
      courseId,
      action.chapter,
      1, // attempt number
      action.answers,
      next.challengePassed[action.chapter],
    );
  }

  // Record final quiz attempt if answers provided
  if (action.type === "pass-verification" && action.answers) {
    await recordFinalQuizAttempt(
      db,
      userId,
      courseId,
      action.answers,
      next.verification === "passed",
    );
  }

  return Response.json({ progress: updated, changed: true });
}

// ---------------------------------------------------------------------------
// DELETE — reset progress for a course
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const courseId = searchParams.get("courseId");

  if (!userId || !courseId) {
    return Response.json({ error: "userId and courseId required" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(courseProgress)
    .where(
      and(
        eq(courseProgress.userId, userId),
        eq(courseProgress.courseId, courseId),
      ),
    )
    .returning();

  return Response.json({ deleted: !!deleted });
}
