import { eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import { courseProgress } from "../../../db/schema";
import { requireAuth } from "../../../lib/auth";
import { getOrCreateProgress } from "../../../lib/repositories";
import { isFarmProgress } from "../../../lib/progress";
import type { FarmProgress } from "../../../lib/types";

// ---------------------------------------------------------------------------
// POST /api/checkpoint — 保存断点
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as {
    courseId: string;
    state: FarmProgress;
  };

  const { courseId, state } = body;

  if (!courseId || !state) {
    return Response.json({ error: "courseId 和 state 不能为空" }, { status: 400 });
  }
  if (!["web3", "monad", "contract"].includes(courseId)) {
    return Response.json({ error: "课程编号无效" }, { status: 400 });
  }
  if (!isFarmProgress(state)) {
    return Response.json({ error: "课程进度数据无效" }, { status: 400 });
  }

  // 立即持久化进度
  const now = new Date().toISOString();
  await getOrCreateProgress(db, auth.userId, courseId);

  await db
    .update(courseProgress)
    .set({
      started: state.started ? 1 : 0,
      seedGranted: state.seedGranted ? 1 : 0,
      landCleared: state.landCleared ? 1 : 0,
      planted: state.planted ? 1 : 0,
      chaptersRead: JSON.stringify(state.chaptersRead),
      challengePassed: JSON.stringify(state.challengePassed),
      challengeMistakes: JSON.stringify(state.challengeMistakes),
      verification: state.verification,
      harvested: state.harvested ? 1 : 0,
      recentActivity: JSON.stringify(state.recentActivity),
      updatedAt: now,
    })
    .where(
      and(
        eq(courseProgress.userId, auth.userId),
        eq(courseProgress.courseId, courseId),
      ),
    );

  return Response.json({
    message: "进度已保存",
    savedAt: now,
  });
}

// ---------------------------------------------------------------------------
// GET /api/checkpoint — 读取断点
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
    return Response.json({ state: null });
  }

  function parseJsonArray<T>(value: string | null): T[] {
    if (!value) return [];
    try {
      return JSON.parse(value) as T[];
    } catch {
      return [];
    }
  }

  const state: FarmProgress = {
    version: 1,
    started: Boolean(progress.started),
    seedGranted: Boolean(progress.seedGranted),
    landCleared: Boolean(progress.landCleared),
    planted: Boolean(progress.planted),
    chaptersRead: parseJsonArray<boolean>(progress.chaptersRead) as [boolean, boolean, boolean],
    challengePassed: parseJsonArray<boolean>(progress.challengePassed) as [boolean, boolean, boolean],
    challengeMistakes: parseJsonArray<boolean>(progress.challengeMistakes) as [boolean, boolean, boolean],
    verification: progress.verification as FarmProgress["verification"],
    harvested: Boolean(progress.harvested),
    recentActivity: parseJsonArray<string>(progress.recentActivity),
  };

  return Response.json({
    state,
    savedAt: progress.updatedAt,
  });
}
